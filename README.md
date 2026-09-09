# Audit Countdown

A GNOME Shell extension built for security auditors who want to track audit deadlines, measure their audit speed, and record when vulnerabilities are discovered — directly from the GNOME top panel.

## Features

### Live Audit Countdown

Displays the active audit and remaining time directly in the GNOME top panel.

The countdown updates every 5 seconds and shows:

```text
My Audit: 3d 8h 42m left
```

When the deadline passes:

```text
My Audit: Time is up!
```

When no audit is active:

```text
Security Audit: No tracking active
```

### 1. Custom Schedule

Set your own audit start and end times.

You can configure:

* Audit name
* Start date and time
* Start timezone
* End date and time
* End timezone

The extension accepts IANA timezones such as `Africa/Lagos`, as well as `UTC`/`GMT` and `WAT`.

### 2. Auto Schedule

Useful for audit contests with a fixed duration.

Enter the contest's original start and end times, then select **Start Auto Audit Now**.

The extension:

1. Calculates the original contest duration.
2. Records the time you started your audit on your machine.
3. Creates a new deadline using that same duration.
4. Starts the live countdown automatically.

This lets you reproduce the contest's time limit even when you're starting your practice audit later.

### 3. Submission Comparison

Compare your audit speed against another researcher's submission time.

Enter:

* Original contest start time
* Other researcher's submission time
* Your submission time

The extension calculates each elapsed duration and tells you whether you were faster, slower, or took the same amount of time.

Example:

```text
Submitter's Elapsed: 2d 4h 10m
Your Elapsed Time: 1d 18h 32m

Result: You were 9h 38m FASTER.
```

This is useful for tracking how quickly you reach a finding and submit it compared with other researchers.

### 4. Vulnerability Snapshots

Record the exact time you discover a vulnerability.

Enter a vulnerability name or bug ID and press **Take Snapshot (Now)**.

Each snapshot stores:

* Vulnerability name
* Discovery timestamp
* Elapsed time since your active audit started

The snapshot is also copied to the clipboard in a report-friendly format:

```text
[SNAPSHOT] Reentrancy in withdraw() | Time: 2026-09-10 14:30 UTC | Elapsed: 5h 20m
```

Snapshots persist between restarts and can be cleared from the extension menu.

## Persistent Local Storage

Audit settings, active countdown state, submission data, and vulnerability snapshots are stored locally in:

```text
~/.config/audit-countdown.json
```

No external service or account is required. The extension uses GNOME's GLib/Gio APIs for local configuration storage.

## Requirements

* GNOME Shell 45
* GNOME Shell 46
* GNOME Shell 47

The supported versions are declared in the extension metadata.

## Installation

### Manual Installation

Clone the repository directly into your local GNOME extensions directory:

```bash
git clone https://github.com/0xactlysis/Audit-Countdown.git \
  ~/.local/share/gnome-shell/extensions/audit-countdown@0xactlysis.github.io
```

Then enable the extension:

```bash
gnome-extensions enable audit-countdown@0xactlysis.github.io
```

You can also enable it through the GNOME **Extensions** application.

After installing or updating the extension, restart GNOME Shell or log out and back in as appropriate for your session.

## Packaging

To create a distributable GNOME extension package, run:

```bash
gnome-extensions pack audit-countdown@0xactlysis.github.io
```

Run the command from the directory containing the extension folder.

## How It Works

The extension is implemented as a GNOME Shell panel indicator using GJS, St, Clutter, GLib, and Gio.

The countdown is recalculated from the current local system time every 5 seconds. Audit state and snapshots are serialized to a local JSON configuration file and restored when the extension starts.

## Built With

* JavaScript
* GJS
* GNOME Shell APIs
* GLib
* Gio
* St
* Clutter

## License
MIT License

## COntributions are allowed Please!
