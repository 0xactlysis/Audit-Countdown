# Audit Countdown

A GNOME Shell extension for security researchers who want to track audit time, deadlines, and vulnerability discovery directly from the top panel.

> Built for auditors. Open to contributions.

## Why?

When auditing, it is useful to know not only **when the audit ends**, but also **how long you spent reaching a finding**.

Audit Countdown provides a simple way to keep your audit deadline visible and record useful timing information while you work.

## Features

### Live Audit Countdown

The active audit countdown is displayed directly in the GNOME top panel.

Example:

```text
Vault V2 Audit: 2d 8h 31m left
```

When the deadline passes:

```text
Vault V2 Audit: Time is up!
```

When no audit is active:

```text
Vault V2 Audit: No tracking active
```

The countdown automatically updates while you work.

### Custom Schedule

Set an audit manually using:

* Audit name
* Start date
* Start time
* Start timezone
* End date
* End time
* End timezone

Timezones can be specified using IANA timezone identifiers such as:

```text
Africa/Lagos
America/New_York
Europe/London
UTC
```

`WAT` is also supported as an alias for `Africa/Lagos`.

### Auto Schedule

Useful for reproducing the time limit of an audit contest during practice.

Enter the original contest start and end times, then select:

**Start Auto Audit Now**

The extension calculates the original contest duration and starts a new local audit using that same duration.

For example:

```text
Original contest:
Start: 2026-09-01 10:00 UTC
End:   2026-09-15 10:00 UTC

Your practice:
Start: now
End:   now + 14 days
```

This makes it easier to run practice audits under the same time constraint.

### Submission Comparison

Compare your submission time with another researcher's submission.

Enter:

* Original contest start
* Their submission time
* Your submission time

The extension calculates the elapsed time for each submission and shows whether you were faster, slower, or took the same amount of time.

Example:

```text
Submitter's Elapsed: 2d 4h 10m
Your Elapsed Time: 1d 18h 32m

Result: You were 9h 38m FASTER.
```

This can be useful for tracking how quickly you reach and submit findings.

### Vulnerability Snapshots

Record the moment you discover a vulnerability.

Enter a vulnerability name or bug ID and select:

**Take Snapshot (Now)**

Each snapshot records:

* Vulnerability name / bug ID
* Discovery timestamp
* Elapsed time from the active audit start

The snapshot is also copied to the clipboard in a report-friendly format:

```text
[SNAPSHOT] Reentrancy in withdraw() | Time: 2026-09-10 14:30 UTC | Elapsed: 5h 20m
```

Snapshots are kept locally and remain available after restarting GNOME Shell.

### Local Persistence

Audit settings, active audit timing, submission comparison data, and vulnerability snapshots are saved locally.

The configuration file is:

```text
~/.config/audit-countdown.json
```

No account or external service is required.

## Installation

### Manual Installation

Clone the repository into your GNOME extensions directory:

```bash
git clone https://github.com/0xactlysis/Audit-Countdown.git \
  ~/.local/share/gnome-shell/extensions/audit-countdown@0xactlysis.github.io
```

Enable the extension:

```bash
gnome-extensions enable audit-countdown@0xactlysis.github.io
```

You can also enable it through the GNOME Extensions application.

### Restarting GNOME Shell

On X11:

```text
Alt + F2 → r → Enter
```

On Wayland, log out and log back in.

## Requirements

* GNOME Shell 45
* GNOME Shell 46
* GNOME Shell 47

## Packaging

To create a GNOME extension package for distribution:

```bash
gnome-extensions pack audit-countdown@0xactlysis.github.io
```

Run this command from the directory containing the extension folder.

## Development

The extension is written in JavaScript using GJS and GNOME Shell APIs.

Main technologies:

* JavaScript
* GJS
* GLib
* Gio
* St
* Clutter
* GNOME Shell PanelMenu / PopupMenu APIs

## Contributing

Audit Countdown is an early-stage open-source project, and contributions are welcome.

Useful contributions include:

* Bug fixes
* GNOME version compatibility
* UI/UX improvements
* Better validation and error handling
* New audit-time tracking features
* Testing
* Documentation improvements
* Feature ideas from other auditors

Open an issue before making a large change so the approach can be discussed.

Pull requests are welcome.

## Project Status

This project is actively usable but still evolving.

It was originally built to solve a personal audit workflow problem and is now being open-sourced so other security researchers can use it, find problems, and help improve it.

Expect rough edges, missing features, and opportunities for improvement.

## License

MIT License
