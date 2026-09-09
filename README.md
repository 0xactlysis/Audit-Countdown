# Audit Countdown ⏱️

A lightweight GNOME Shell extension that keeps critical deadlines and security audits visible directly in your desktop's top panel with a live, updating countdown timer.

---

## ✨ Features

* **Top Panel Indicator:** Displays a live countdown right in the GNOME status bar.
* **Smart Formatting:** Automatically adjusts based on time remaining—showing days and hours when far out, or shifting to hours and minutes as the deadline approaches.
* **Interactive Dropdown Menu:** Click the panel item to open a built-in settings menu where you can instantly update the audit name, target date (`YYYY-MM-DD`), and 24-hour time (`HH:MM`).
* **Persistent Configuration:** Automatically saves your countdown details locally using GLib/Gio so your settings survive desktop reboots and shell restarts.

---

## 📋 Requirements

* **GNOME Shell:** Version 45, 46, or 47

---

## 🚀 Installation

### Manual Installation

1. Clone or download this repository into your local GNOME extensions directory:
   ```bash
   git clone git@github.com:0xactlysis/Audit-Countdown.git ~/.local/share/gnome-shell/extensions/audit-countdown@0xactlysis.github.io


2. Restart GNOME Shell:
* **On X11:** Press `Alt + F2`, type `r`, and press `Enter`.
* **On Wayland:** Log out and log back in.


3. Enable the extension using the `Extensions` app or via terminal:
```bash
gnome-extensions enable audit-countdown@0xactlysis.github.io


---

## 📦 Packaging for Distribution

If you want to pack the extension for distribution or submission to [extensions.gnome.org](https://extensions.gnome.org/), run the following command from the parent directory:

```bash
gnome-extensions pack audit-countdown@0xactlysis.github.io

```

---

## 🛠️ Built With

* JavaScript (ES6 Modules via GJS)
* GNOME Shell St and Clutter UI libraries

Please feel free to contribute
