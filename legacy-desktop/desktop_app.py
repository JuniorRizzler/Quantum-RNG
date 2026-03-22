from __future__ import annotations

import argparse
import json
import threading
import time
import tkinter as tk
from dataclasses import asdict
from pathlib import Path
from tkinter import messagebox, ttk

import cv2
from PIL import Image, ImageTk

from qrng.camera_entropy import CameraEntropySource
from qrng.extractor import EXTRACTION_MODES, extract_entropy
from qrng.stats import RandomnessStats, compute_stats

SURFACE_BG = "#08111d"
CARD_BG = "#102033"
ACCENT = "#49dcb1"
ACCENT_ALT = "#74c0fc"
TEXT_MAIN = "#edf6ff"
TEXT_MUTED = "#a9bdd1"
WARN = "#ffd166"
FAIL = "#ff6b6b"


def random_int_from_bytes(data: bytes, minimum: int, maximum: int) -> int:
    if minimum > maximum:
        raise ValueError("Minimum cannot be greater than maximum.")
    if not data:
        raise ValueError("No random bytes available.")
    span = maximum - minimum + 1
    nbytes = max(1, ((span - 1).bit_length() + 7) // 8)
    limit = (1 << (8 * nbytes)) - ((1 << (8 * nbytes)) % span)
    for start in range(0, len(data) - nbytes + 1, nbytes):
        candidate = int.from_bytes(data[start : start + nbytes], "big")
        if candidate < limit:
            return minimum + (candidate % span)
    raise ValueError("Not enough unbiased random data for the requested range. Generate more bytes or use more blocks.")


class QRNGEngine:
    def __init__(self, camera_index: int = 0) -> None:
        self.source = CameraEntropySource(camera_index=camera_index)

    def generate_bytes(self, blocks: int = 8, mode: str = "sha256_whitened") -> tuple[bytes, dict]:
        output = bytearray()
        raw_bits_total = 0
        extracted_bits_total = 0
        last_sample = None

        for _ in range(blocks):
            sample = self.source.read_sample()
            last_sample = sample
            result = extract_entropy(sample.lsb_bits, mode=mode, blocks=1)
            raw_bits_total += result.raw_bit_count
            extracted_bits_total += result.extracted_bit_count
            output.extend(result.output_bytes)

        byte_output = bytes(output)
        stats = compute_stats(byte_output)
        meta = {
            "raw_bits_total": raw_bits_total,
            "extracted_bits_total": extracted_bits_total,
            "stats": stats,
            "last_sample": last_sample,
            "mode": mode,
        }
        return byte_output, meta

    def close(self) -> None:
        self.source.close()


class QRNGApp:
    def __init__(self, root: tk.Tk, camera_index: int = 0) -> None:
        self.root = root
        self.root.title("Camera Noise RNG Lab")
        self.root.geometry("1380x900")

        self.engine = QRNGEngine(camera_index=camera_index)
        self.running = False
        self.preview_job: str | None = None
        self.generated_bytes = b""
        self.last_meta: dict | None = None
        self.history: list[RandomnessStats] = []
        self.comparisons: list[dict] = []

        self.status_var = tk.StringVar(value="Idle")
        self.stats_var = tk.StringVar(value="No data yet.")
        self.integer_var = tk.StringVar(value="No number generated yet.")
        self.mode_var = tk.StringVar(value="sha256_whitened")
        self.condition_var = tk.StringVar(value="lens covered")
        self.condition_note_var = tk.StringVar(value="")
        self.blocks_var = tk.IntVar(value=8)
        self.min_var = tk.IntVar(value=1)
        self.max_var = tk.IntVar(value=100)
        self.summary_var = tk.StringVar(value="No sample yet")

        self._build_ui()
        self._start_preview()
        self.root.protocol("WM_DELETE_WINDOW", self._on_close)

    def _build_ui(self) -> None:
        self._configure_theme()
        main = ttk.Frame(self.root, padding=16)
        main.pack(fill="both", expand=True)
        main.columnconfigure(0, weight=3)
        main.columnconfigure(1, weight=2)
        main.rowconfigure(1, weight=1)

        title = ttk.Label(main, text="Camera Noise RNG Lab", style="Title.TLabel")
        title.grid(row=0, column=0, sticky="w")
        subtitle = ttk.Label(
            main,
            text="Hardware-noise experiment: compare conditions, test extraction modes, and export a mini report.",
            style="Muted.TLabel",
        )
        subtitle.grid(row=0, column=1, sticky="e")

        left = ttk.Frame(main)
        left.grid(row=1, column=0, sticky="nsew", padx=(0, 10))
        left.rowconfigure(1, weight=1)
        left.rowconfigure(2, weight=1)
        left.columnconfigure(0, weight=1)

        right = ttk.Frame(main)
        right.grid(row=1, column=1, sticky="nsew")
        right.rowconfigure(2, weight=1)
        right.columnconfigure(0, weight=1)

        controls = ttk.LabelFrame(left, text="Controls", padding=12)
        controls.grid(row=0, column=0, sticky="ew", pady=(0, 10))

        ttk.Label(controls, text="Mode").grid(row=0, column=0, sticky="w")
        ttk.Combobox(controls, textvariable=self.mode_var, values=list(EXTRACTION_MODES), state="readonly", width=18).grid(row=0, column=1, sticky="w", padx=(6, 12))
        ttk.Label(controls, text="Blocks").grid(row=0, column=2, sticky="w")
        ttk.Spinbox(controls, from_=1, to=64, textvariable=self.blocks_var, width=6).grid(row=0, column=3, sticky="w", padx=(6, 12))
        ttk.Button(controls, text="Generate Sample", command=self.generate_once).grid(row=0, column=4, padx=(6, 6))
        ttk.Button(controls, text="Generate Integer", command=self.generate_integer).grid(row=0, column=5, padx=(6, 6))
        ttk.Button(controls, text="Save Bytes", command=self.save_bytes).grid(row=0, column=6, padx=(6, 6))
        ttk.Label(controls, textvariable=self.status_var).grid(row=0, column=7, sticky="e")

        ttk.Label(controls, text="Min").grid(row=1, column=0, sticky="w", pady=(10, 0))
        ttk.Entry(controls, textvariable=self.min_var, width=8).grid(row=1, column=1, sticky="w", padx=(6, 12), pady=(10, 0))
        ttk.Label(controls, text="Max").grid(row=1, column=2, sticky="w", pady=(10, 0))
        ttk.Entry(controls, textvariable=self.max_var, width=8).grid(row=1, column=3, sticky="w", padx=(6, 12), pady=(10, 0))
        ttk.Label(controls, text="Condition").grid(row=1, column=4, sticky="w", pady=(10, 0))
        ttk.Combobox(
            controls,
            textvariable=self.condition_var,
            values=["lens covered", "room light", "moving scene", "textured object", "custom"],
            state="readonly",
            width=16,
        ).grid(row=1, column=5, sticky="w", pady=(10, 0))
        ttk.Entry(controls, textvariable=self.condition_note_var, width=28).grid(row=1, column=6, sticky="ew", padx=(6, 6), pady=(10, 0))
        ttk.Button(controls, text="Record Comparison", command=self.record_comparison).grid(row=1, column=7, sticky="e", pady=(10, 0))

        preview_frame = ttk.LabelFrame(left, text="Entropy Preview", padding=12)
        preview_frame.grid(row=1, column=0, sticky="nsew", pady=(0, 10))
        preview_frame.rowconfigure(0, weight=1)
        preview_frame.columnconfigure(0, weight=1)
        self.preview_label = ttk.Label(preview_frame)
        self.preview_label.grid(row=0, column=0, sticky="nsew")

        viz_frame = ttk.LabelFrame(left, text="Live Charts", padding=12)
        viz_frame.grid(row=2, column=0, sticky="nsew")
        viz_frame.columnconfigure(0, weight=1)
        viz_frame.columnconfigure(1, weight=1)
        viz_frame.rowconfigure(0, weight=1)
        self.hist_canvas = tk.Canvas(viz_frame, width=420, height=220, bg="#081421", highlightthickness=0)
        self.hist_canvas.grid(row=0, column=0, sticky="nsew", padx=(0, 8))
        self.history_canvas = tk.Canvas(viz_frame, width=420, height=220, bg="#081421", highlightthickness=0)
        self.history_canvas.grid(row=0, column=1, sticky="nsew")

        integer_frame = ttk.LabelFrame(right, text="Random Whole Number", padding=12)
        integer_frame.grid(row=0, column=0, sticky="ew", pady=(0, 10))
        ttk.Label(integer_frame, textvariable=self.integer_var, style="Number.TLabel").pack(anchor="w")
        ttk.Label(integer_frame, textvariable=self.summary_var, style="Muted.TLabel").pack(anchor="w", pady=(6, 0))

        stats_frame = ttk.LabelFrame(right, text="Randomness Tests", padding=12)
        stats_frame.grid(row=1, column=0, sticky="ew", pady=(0, 10))
        ttk.Label(stats_frame, textvariable=self.stats_var, justify="left").pack(anchor="w")

        notebook = ttk.Notebook(right)
        notebook.grid(row=2, column=0, sticky="nsew")

        output_tab = ttk.Frame(notebook, padding=10)
        compare_tab = ttk.Frame(notebook, padding=10)
        notes_tab = ttk.Frame(notebook, padding=10)
        notebook.add(output_tab, text="Output")
        notebook.add(compare_tab, text="Comparison Log")
        notebook.add(notes_tab, text="Notes / Export")

        output_tab.rowconfigure(0, weight=1)
        output_tab.columnconfigure(0, weight=1)
        self.output_text = tk.Text(output_tab, wrap="word", font=("Consolas", 10))
        self.output_text.grid(row=0, column=0, sticky="nsew")
        self.output_text.configure(bg="#081421", fg=TEXT_MAIN, insertbackground=TEXT_MAIN, relief="flat")

        compare_tab.rowconfigure(0, weight=1)
        compare_tab.columnconfigure(0, weight=1)
        self.compare_text = tk.Text(compare_tab, wrap="word", font=("Consolas", 10))
        self.compare_text.grid(row=0, column=0, sticky="nsew")
        self.compare_text.configure(bg="#081421", fg=TEXT_MAIN, insertbackground=TEXT_MAIN, relief="flat")

        ttk.Label(
            notes_tab,
            justify="left",
            text=(
                "Suggested experiment:\n"
                "1. Set mode to sha256_whitened.\n"
                "2. Record 'lens covered', 'room light', and 'moving scene'.\n"
                "3. Compare ones ratio, entropy, and test pass/fail.\n"
                "4. Export a report and explain what changed.\n\n"
                "This is a hardware-noise prototype, not a certified quantum RNG."
            ),
        ).pack(anchor="w")
        ttk.Button(notes_tab, text="Export Report", command=self.export_report).pack(anchor="w", pady=(12, 0))

    def _configure_theme(self) -> None:
        self.root.configure(bg=SURFACE_BG)
        style = ttk.Style(self.root)
        if "clam" in style.theme_names():
            style.theme_use("clam")
        style.configure(".", background=SURFACE_BG, foreground=TEXT_MAIN, fieldbackground=CARD_BG)
        style.configure("TFrame", background=SURFACE_BG)
        style.configure("TLabelframe", background=SURFACE_BG, foreground=TEXT_MAIN)
        style.configure("TLabelframe.Label", background=SURFACE_BG, foreground=TEXT_MAIN, font=("Segoe UI", 11, "bold"))
        style.configure("TLabel", background=SURFACE_BG, foreground=TEXT_MAIN, font=("Segoe UI", 10))
        style.configure("Muted.TLabel", background=SURFACE_BG, foreground=TEXT_MUTED, font=("Segoe UI", 10))
        style.configure("Title.TLabel", background=SURFACE_BG, foreground=TEXT_MAIN, font=("Segoe UI Semibold", 22))
        style.configure("Number.TLabel", background=SURFACE_BG, foreground=ACCENT, font=("Segoe UI Semibold", 24))
        style.configure("TButton", background=CARD_BG, foreground=TEXT_MAIN, padding=8)
        style.map("TButton", background=[("active", "#17314e")])
        style.configure("TEntry", fieldbackground=CARD_BG, foreground=TEXT_MAIN)
        style.configure("TSpinbox", fieldbackground=CARD_BG, foreground=TEXT_MAIN)
        style.configure("TCombobox", fieldbackground=CARD_BG, foreground=TEXT_MAIN)
        style.configure("TNotebook", background=SURFACE_BG, borderwidth=0)
        style.configure("TNotebook.Tab", background=CARD_BG, foreground=TEXT_MUTED, padding=(12, 8))
        style.map("TNotebook.Tab", background=[("selected", "#17314e")], foreground=[("selected", TEXT_MAIN)])

    def _start_preview(self) -> None:
        try:
            sample = self.engine.source.read_sample()
            image = cv2.cvtColor(sample.mixed_pixels, cv2.COLOR_GRAY2RGB)
            image = Image.fromarray(image).resize((760, 360))
            photo = ImageTk.PhotoImage(image)
            self.preview_label.image = photo
            self.preview_label.configure(image=photo)
            self.status_var.set("Preview live")
        except Exception as exc:
            self.status_var.set("Camera error")
            self.preview_label.configure(text=str(exc))
        finally:
            self.preview_job = self.root.after(120, self._start_preview)

    def generate_once(self) -> None:
        if self.running:
            return
        self.running = True
        self.status_var.set("Generating sample...")
        threading.Thread(target=self._generate_worker, daemon=True).start()

    def _generate_worker(self) -> None:
        try:
            start = time.perf_counter()
            data, meta = self.engine.generate_bytes(blocks=self.blocks_var.get(), mode=self.mode_var.get())
            elapsed = time.perf_counter() - start
            stats: RandomnessStats = meta["stats"]
            self.generated_bytes = data
            self.last_meta = meta
            self.history.append(stats)
            if len(self.history) > 40:
                self.history = self.history[-40:]
            stats_text = self._format_stats(stats, meta, elapsed)
            hex_output = data.hex()
            self.root.after(0, lambda: self._update_output(stats_text, hex_output, stats))
        except Exception as exc:
            self.root.after(0, lambda: messagebox.showerror("Generation failed", str(exc)))
            self.root.after(0, lambda: self.status_var.set("Error"))
        finally:
            self.running = False

    def _format_stats(self, stats: RandomnessStats, meta: dict, elapsed: float) -> str:
        return (
            f"Mode: {meta['mode']}\n"
            f"Output bytes: {len(self.generated_bytes)}\n"
            f"Ones ratio: {stats.one_ratio:.4f} {'PASS' if abs(stats.one_ratio - 0.5) < 0.03 else 'CHECK'}\n"
            f"Byte entropy: {stats.byte_entropy:.4f} / 8.0000\n"
            f"Monobit z-score: {stats.monobit_zscore:.3f} {'PASS' if stats.monobit_pass else 'FAIL'}\n"
            f"Runs: {stats.runs} vs expected {stats.expected_runs:.1f} {'PASS' if stats.runs_pass else 'FAIL'}\n"
            f"Serial correlation: {stats.serial_correlation:.4f} {'PASS' if stats.serial_pass else 'FAIL'}\n"
            f"Chi-square (8-bit bins): {stats.chi_square_8bit:.2f}\n"
            f"Raw bits sampled: {meta['raw_bits_total']}\n"
            f"Bits after extraction: {meta['extracted_bits_total']}\n"
            f"Runtime: {elapsed:.2f}s"
        )

    def _update_output(self, stats_text: str, hex_output: str, stats: RandomnessStats) -> None:
        self.stats_var.set(stats_text)
        self.output_text.delete("1.0", tk.END)
        self.output_text.insert("1.0", hex_output)
        self._draw_histogram(stats.byte_histogram)
        self._draw_history()
        self.summary_var.set(self._quality_summary(stats))
        self.status_var.set("Sample ready")

    def _quality_summary(self, stats: RandomnessStats) -> str:
        passes = sum([stats.monobit_pass, stats.runs_pass, stats.serial_pass])
        if passes == 3 and abs(stats.one_ratio - 0.5) < 0.02 and stats.byte_entropy > 6.5:
            return "Quality: strong sample"
        if passes >= 2:
            return "Quality: usable sample"
        return "Quality: unstable sample, try a different scene or more blocks"

    def _draw_histogram(self, counts: list[int]) -> None:
        canvas = self.hist_canvas
        canvas.delete("all")
        width = int(canvas["width"])
        height = int(canvas["height"])
        canvas.create_text(10, 10, anchor="nw", fill="white", text="Byte Histogram")
        if not counts or max(counts) == 0:
            return
        group = 16
        grouped = [sum(counts[i : i + group]) for i in range(0, 256, group)]
        max_count = max(grouped)
        bar_w = (width - 30) / len(grouped)
        for i, count in enumerate(grouped):
            x0 = 20 + i * bar_w
            x1 = x0 + bar_w - 2
            bar_h = (height - 40) * (count / max_count)
            y0 = height - 20 - bar_h
            canvas.create_rectangle(x0, y0, x1, height - 20, fill="#32d1ff", outline="")
        canvas.create_text(20, height - 12, anchor="w", fill="#a9c7d9", text="0-255 grouped into 16 bins")

    def _draw_history(self) -> None:
        canvas = self.history_canvas
        canvas.delete("all")
        width = int(canvas["width"])
        height = int(canvas["height"])
        canvas.create_text(10, 10, anchor="nw", fill="white", text="Entropy / Ones Ratio History")
        if not self.history:
            return
        entropies = [item.byte_entropy / 8.0 for item in self.history]
        ratios = [item.one_ratio for item in self.history]

        def draw_series(values: list[float], color: str, y_min: float, y_max: float) -> None:
            pts = []
            for idx, value in enumerate(values):
                x = 20 + idx * ((width - 40) / max(len(values) - 1, 1))
                norm = 0 if y_max == y_min else (value - y_min) / (y_max - y_min)
                y = height - 25 - norm * (height - 50)
                pts.extend((x, y))
            if len(pts) >= 4:
                canvas.create_line(*pts, fill=color, width=2, smooth=True)

        draw_series(entropies, "#6ef3a5", 0.0, 1.0)
        draw_series(ratios, "#ffd166", 0.35, 0.65)
        canvas.create_text(20, height - 12, anchor="w", fill="#6ef3a5", text="green = entropy/8")
        canvas.create_text(150, height - 12, anchor="w", fill="#ffd166", text="yellow = ones ratio")

    def generate_integer(self) -> None:
        if not self.generated_bytes:
            self.generate_once()
            self.root.after(900, self.generate_integer)
            return
        try:
            value = random_int_from_bytes(self.generated_bytes, self.min_var.get(), self.max_var.get())
        except ValueError as exc:
            messagebox.showerror("Integer generation failed", str(exc))
            return
        self.integer_var.set(f"{value}  (range {self.min_var.get()} to {self.max_var.get()})")
        self.status_var.set("Random integer generated")

    def record_comparison(self) -> None:
        if not self.last_meta:
            messagebox.showinfo("No sample", "Generate a sample first.")
            return
        stats: RandomnessStats = self.last_meta["stats"]
        entry = {
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "condition": self.condition_var.get(),
            "note": self.condition_note_var.get().strip(),
            "mode": self.last_meta["mode"],
            "blocks": self.blocks_var.get(),
            "ones_ratio": round(stats.one_ratio, 5),
            "byte_entropy": round(stats.byte_entropy, 5),
            "monobit_pass": stats.monobit_pass,
            "runs_pass": stats.runs_pass,
            "serial_pass": stats.serial_pass,
            "chi_square": round(stats.chi_square_8bit, 4),
        }
        self.comparisons.append(entry)
        self._refresh_comparisons()
        self.status_var.set("Comparison recorded")

    def _refresh_comparisons(self) -> None:
        self.compare_text.delete("1.0", tk.END)
        if not self.comparisons:
            self.compare_text.insert("1.0", "No comparisons recorded yet.")
            return
        lines = []
        for idx, entry in enumerate(self.comparisons, start=1):
            lines.append(
                f"{idx}. {entry['timestamp']} | {entry['condition']} | mode={entry['mode']} | "
                f"entropy={entry['byte_entropy']:.4f} | ones={entry['ones_ratio']:.4f} | "
                f"tests={'PASS' if entry['monobit_pass'] and entry['runs_pass'] and entry['serial_pass'] else 'CHECK'}"
            )
            if entry["note"]:
                lines.append(f"   note: {entry['note']}")
        self.compare_text.insert("1.0", "\n".join(lines))

    def save_bytes(self) -> None:
        if not self.generated_bytes:
            messagebox.showinfo("No output", "Generate random bytes first.")
            return
        output_dir = Path.cwd() / "output"
        output_dir.mkdir(exist_ok=True)
        path = output_dir / f"qrng_{int(time.time())}.bin"
        path.write_bytes(self.generated_bytes)
        messagebox.showinfo("Saved", f"Saved {len(self.generated_bytes)} bytes to:\n{path}")

    def export_report(self) -> None:
        output_dir = Path.cwd() / "output"
        output_dir.mkdir(exist_ok=True)
        timestamp = int(time.time())
        report_path = output_dir / f"qrng_report_{timestamp}.json"
        markdown_path = output_dir / f"qrng_report_{timestamp}.md"
        payload = {
            "project": "Camera Noise RNG Lab",
            "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            "current_mode": self.mode_var.get(),
            "current_blocks": self.blocks_var.get(),
            "current_integer_range": [self.min_var.get(), self.max_var.get()],
            "latest_stats": asdict(self.last_meta["stats"]) if self.last_meta else None,
            "comparisons": self.comparisons,
            "notes": [
                "This is a hardware-noise RNG prototype using a camera sensor.",
                "It is not a certified true quantum random number generator.",
                "Use it as an experiment in entropy collection, extraction, and testing.",
            ],
        }
        report_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        markdown_path.write_text(self._build_markdown_report(payload), encoding="utf-8")
        messagebox.showinfo("Report exported", f"Saved report to:\n{report_path}\n\n{markdown_path}")

    def _build_markdown_report(self, payload: dict) -> str:
        lines = [
            "# Camera Noise RNG Lab Report",
            "",
            f"- Generated at: {payload['generated_at']}",
            f"- Mode: {payload['current_mode']}",
            f"- Blocks: {payload['current_blocks']}",
            f"- Integer range: {payload['current_integer_range'][0]} to {payload['current_integer_range'][1]}",
            "",
            "## Latest Stats",
        ]
        latest = payload["latest_stats"]
        if latest:
            lines.extend(
                [
                    f"- Ones ratio: {latest['one_ratio']:.4f}",
                    f"- Byte entropy: {latest['byte_entropy']:.4f} / 8.0000",
                    f"- Monobit pass: {latest['monobit_pass']}",
                    f"- Runs pass: {latest['runs_pass']}",
                    f"- Serial pass: {latest['serial_pass']}",
                    f"- Chi-square: {latest['chi_square_8bit']:.2f}",
                ]
            )
        else:
            lines.append("- No sample recorded")
        lines.extend(["", "## Comparison Log"])
        if payload["comparisons"]:
            for item in payload["comparisons"]:
                lines.append(
                    f"- {item['timestamp']} | {item['condition']} | mode={item['mode']} | entropy={item['byte_entropy']:.4f} | ones={item['ones_ratio']:.4f}"
                )
                if item["note"]:
                    lines.append(f"  note: {item['note']}")
        else:
            lines.append("- No comparisons recorded")
        lines.extend(
            [
                "",
                "## Notes",
                "- This is a hardware-noise RNG prototype using a camera sensor.",
                "- It is not a certified true quantum random number generator.",
                "- Use it as an experiment in entropy collection, extraction, and testing.",
            ]
        )
        return "\n".join(lines)

    def _on_close(self) -> None:
        if self.preview_job is not None:
            self.root.after_cancel(self.preview_job)
        self.engine.close()
        self.root.destroy()


def run_cli(camera_index: int, blocks: int, mode: str, minimum: int | None, maximum: int | None) -> None:
    engine = QRNGEngine(camera_index=camera_index)
    try:
        data, meta = engine.generate_bytes(blocks=blocks, mode=mode)
        stats: RandomnessStats = meta["stats"]
        print("Camera Noise RNG Lab")
        print(f"Mode: {mode}")
        print(f"Output bytes: {len(data)}")
        print(f"Output hex: {data.hex()}")
        if minimum is not None and maximum is not None:
            print(f"Random integer [{minimum}, {maximum}]: {random_int_from_bytes(data, minimum, maximum)}")
        print(f"Ones ratio: {stats.one_ratio:.4f}")
        print(f"Byte entropy: {stats.byte_entropy:.4f} / 8.0000")
        print(f"Monobit z-score: {stats.monobit_zscore:.3f} pass={stats.monobit_pass}")
        print(f"Runs: {stats.runs} expected={stats.expected_runs:.1f} pass={stats.runs_pass}")
        print(f"Serial correlation: {stats.serial_correlation:.4f} pass={stats.serial_pass}")
        print(f"Chi-square: {stats.chi_square_8bit:.2f}")
    finally:
        engine.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Camera-noise RNG lab")
    parser.add_argument("--cli", action="store_true", help="Run once in the terminal instead of the GUI")
    parser.add_argument("--camera-index", type=int, default=0, help="Camera index to open")
    parser.add_argument("--blocks", type=int, default=8, help="Number of generation rounds")
    parser.add_argument("--mode", type=str, default="sha256_whitened", choices=list(EXTRACTION_MODES), help="Extraction mode")
    parser.add_argument("--min", dest="minimum", type=int, help="Minimum integer to generate")
    parser.add_argument("--max", dest="maximum", type=int, help="Maximum integer to generate")
    args = parser.parse_args()

    if args.cli:
        run_cli(args.camera_index, args.blocks, args.mode, args.minimum, args.maximum)
        return

    root = tk.Tk()
    QRNGApp(root, camera_index=args.camera_index)
    root.mainloop()


if __name__ == "__main__":
    main()
