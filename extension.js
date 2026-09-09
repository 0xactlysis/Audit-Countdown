import Clutter from "gi://Clutter";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import St from "gi://St";
import Gio from "gi://Gio";

import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

const CONFIG_PATH = GLib.get_user_config_dir() + "/audit-countdown.json";

function parseTimeZone(tzStr) {
  if (!tzStr || typeof tzStr !== "string") tzStr = "Africa/Lagos";
  tzStr = tzStr.trim();
  const upper = tzStr.toUpperCase();

  if (upper === "WAT" || upper === "WEST AFRICA TIME") {
    return (
      GLib.TimeZone.new_identifier("Africa/Lagos") ||
      GLib.TimeZone.new("Africa/Lagos")
    );
  }
  if (upper === "UTC" || upper === "GMT") return GLib.TimeZone.new_utc();

  let tz = GLib.TimeZone.new_identifier(tzStr);
  if (tz) return tz;

  try {
    tz = GLib.TimeZone.new(tzStr);
    if (tz) return tz;
  } catch (e) {}

  return (
    GLib.TimeZone.new_identifier("Africa/Lagos") ||
    GLib.TimeZone.new("Africa/Lagos")
  );
}

function createDateTime(dateStr, timeStr, tzStr) {
  if (!dateStr) return null;
  const dateParts = dateStr
    .trim()
    .split("-")
    .map((v) => parseInt(v, 10));
  if (dateParts.length !== 3 || dateParts.some(isNaN)) return null;

  let hour = 0,
    minute = 0;
  if (timeStr) {
    const timeParts = timeStr
      .trim()
      .split(":")
      .map((v) => parseInt(v, 10));
    if (!isNaN(timeParts[0])) hour = timeParts[0];
    if (!isNaN(timeParts[1])) minute = timeParts[1];
  }

  const tz = parseTimeZone(tzStr);
  return GLib.DateTime.new(
    tz,
    dateParts[0],
    dateParts[1],
    dateParts[2],
    hour,
    minute,
    0,
  );
}

function formatDuration(seconds) {
  if (isNaN(seconds)) return "0m";
  const absSec = Math.floor(Math.abs(seconds));
  const d = Math.floor(absSec / 86400);
  const h = Math.floor((absSec % 86400) / 3600);
  const m = Math.floor((absSec % 3600) / 60);

  let parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0 || d > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(" ") || "0m";
}

function formatDualTime(dt, origTzStr) {
  if (!dt) return "N/A";
  const origTz = parseTimeZone(origTzStr);
  const watTz = parseTimeZone("Africa/Lagos");

  const dtOrig = dt.to_timezone(origTz);
  const dtWat = dt.to_timezone(watTz);

  return `${dtOrig.format("%Y-%m-%d %H:%M %Z")} | WAT: ${dtWat.format("%H:%M")}`;
}

const AuditIndicator = GObject.registerClass(
  class AuditIndicator extends PanelMenu.Button {
    _init() {
      super._init(0.0, "Audit Countdown Indicator");

      this._label = new St.Label({
        text: "Audit Tracker",
        y_align: Clutter.ActorAlign.CENTER,
        style_class: "audit-countdown-label",
      });
      this.add_child(this._label);

      this._auditName = "Security Audit";
      this._targetEndDate = null;
      this._myActiveStart = null;
      this._snapshots = [];
      this._timerId = 0;

      this._buildMenu();
      this._loadConfig();
      this._startTimer();
    }

    _createInteractiveEntry(hintText, styleClass) {
      return new St.Entry({
        hint_text: hintText,
        style_class: styleClass,
        can_focus: true,
        reactive: true,
        track_hover: true,
      });
    }

    _createInteractiveButton(labelText, styleClass, callback) {
      const btn = new St.Button({
        label: labelText,
        style_class: styleClass,
        can_focus: true,
        reactive: true,
        track_hover: true,
      });
      btn.connect("clicked", callback.bind(this));
      return btn;
    }

    _buildMenu() {
      const headerItem = new PopupMenu.PopupMenuItem("Audit Management Hub", {
        reactive: false,
      });
      this.menu.addMenuItem(headerItem);
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

      const titleBox = new St.BoxLayout({
        vertical: true,
        style_class: "audit-section-box",
      });
      titleBox.add_child(
        new St.Label({ text: "Audit Name:", style_class: "audit-field-label" }),
      );
      this._nameEntry = this._createInteractiveEntry(
        "e.g. Vault V2 Audit",
        "audit-entry-wide",
      );
      titleBox.add_child(this._nameEntry);

      const titleItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
      titleItem.add_child(titleBox);
      this.menu.addMenuItem(titleItem);
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

      // ==========================================
      // MENU 1: Custom Schedule
      // ==========================================
      this._menu1 = new PopupMenu.PopupSubMenuMenuItem(
        "1. Custom Schedule (Manual)",
      );
      this.menu.addMenuItem(this._menu1);

      const box1 = new St.BoxLayout({
        vertical: true,
        style_class: "audit-section-box",
      });

      const row1Start = new St.BoxLayout({ style_class: "audit-input-row" });
      this._cStartDate = this._createInteractiveEntry(
        "YYYY-MM-DD",
        "audit-entry-date",
      );
      this._cStartTime = this._createInteractiveEntry(
        "09:00",
        "audit-entry-time",
      );
      this._cStartTz = this._createInteractiveEntry("WAT", "audit-entry-tz");
      row1Start.add_child(
        new St.Label({ text: "Start: ", y_align: Clutter.ActorAlign.CENTER }),
      );
      row1Start.add_child(this._cStartDate);
      row1Start.add_child(this._cStartTime);
      row1Start.add_child(this._cStartTz);
      box1.add_child(row1Start);

      const row1End = new St.BoxLayout({ style_class: "audit-input-row" });
      this._cEndDate = this._createInteractiveEntry(
        "YYYY-MM-DD",
        "audit-entry-date",
      );
      this._cEndTime = this._createInteractiveEntry(
        "18:00",
        "audit-entry-time",
      );
      this._cEndTz = this._createInteractiveEntry("WAT", "audit-entry-tz");
      row1End.add_child(
        new St.Label({ text: "End:   ", y_align: Clutter.ActorAlign.CENTER }),
      );
      row1End.add_child(this._cEndDate);
      row1End.add_child(this._cEndTime);
      row1End.add_child(this._cEndTz);
      box1.add_child(row1End);

      const btn1Row = new St.BoxLayout({ style_class: "audit-input-row" });
      const btn1 = this._createInteractiveButton(
        "Set Custom Countdown",
        "audit-countdown-button",
        this._onSaveCustomSchedule,
      );
      const btn1Cancel = this._createInteractiveButton(
        "Cancel Audit",
        "audit-cancel-button",
        this._onCancelAudit,
      );
      btn1Row.add_child(btn1);
      btn1Row.add_child(btn1Cancel);
      box1.add_child(btn1Row);

      const item1 = new PopupMenu.PopupBaseMenuItem({ reactive: false });
      item1.add_child(box1);
      this._menu1.menu.addMenuItem(item1);

      // ==========================================
      // MENU 2: Auto Schedule
      // ==========================================
      this._menu2 = new PopupMenu.PopupSubMenuMenuItem(
        "2. Auto Schedule (System Sync)",
      );
      this.menu.addMenuItem(this._menu2);

      const box2 = new St.BoxLayout({
        vertical: true,
        style_class: "audit-section-box",
      });

      box2.add_child(
        new St.Label({
          text: "Original Contest Dates:",
          style_class: "audit-field-label",
        }),
      );
      const row2OrigStart = new St.BoxLayout({
        style_class: "audit-input-row",
      });
      this._origStartDate = this._createInteractiveEntry(
        "2026-09-01",
        "audit-entry-date",
      );
      this._origStartTime = this._createInteractiveEntry(
        "10:00",
        "audit-entry-time",
      );
      this._origTz = this._createInteractiveEntry("UTC", "audit-entry-tz");
      row2OrigStart.add_child(
        new St.Label({ text: "Start: ", y_align: Clutter.ActorAlign.CENTER }),
      );
      row2OrigStart.add_child(this._origStartDate);
      row2OrigStart.add_child(this._origStartTime);
      row2OrigStart.add_child(this._origTz);
      box2.add_child(row2OrigStart);

      const row2OrigEnd = new St.BoxLayout({ style_class: "audit-input-row" });
      this._origEndDate = this._createInteractiveEntry(
        "2026-09-15",
        "audit-entry-date",
      );
      this._origEndTime = this._createInteractiveEntry(
        "10:00",
        "audit-entry-time",
      );
      row2OrigEnd.add_child(
        new St.Label({ text: "End:   ", y_align: Clutter.ActorAlign.CENTER }),
      );
      row2OrigEnd.add_child(this._origEndDate);
      row2OrigEnd.add_child(this._origEndTime);
      box2.add_child(row2OrigEnd);

      box2.add_child(
        new St.Label({
          text: "Start your audit using your current Ubuntu clock time:",
          style_class: "audit-result-text",
        }),
      );

      const btn2Row = new St.BoxLayout({ style_class: "audit-input-row" });
      const btn2 = this._createInteractiveButton(
        "Start Auto Audit Now",
        "audit-countdown-button",
        this._onStartAutoSchedule,
      );
      const btn2Cancel = this._createInteractiveButton(
        "Cancel Audit",
        "audit-cancel-button",
        this._onCancelAudit,
      );
      btn2Row.add_child(btn2);
      btn2Row.add_child(btn2Cancel);
      box2.add_child(btn2Row);

      this._autoResultsBox = new St.BoxLayout({
        vertical: true,
        style_class: "audit-results-box",
      });
      box2.add_child(this._autoResultsBox);

      const item2 = new PopupMenu.PopupBaseMenuItem({ reactive: false });
      item2.add_child(box2);
      this._menu2.menu.addMenuItem(item2);

      // ==========================================
      // MENU 3: Submissions & Comparison
      // ==========================================
      this._menu3 = new PopupMenu.PopupSubMenuMenuItem(
        "3. Submissions & Comparison",
      );
      this.menu.addMenuItem(this._menu3);

      const box3 = new St.BoxLayout({
        vertical: true,
        style_class: "audit-section-box",
      });

      box3.add_child(
        new St.Label({
          text: "Submitter's Submission Time:",
          style_class: "audit-field-label",
        }),
      );
      const row3Other = new St.BoxLayout({ style_class: "audit-input-row" });
      this._otherSubDate = this._createInteractiveEntry(
        "2026-09-10",
        "audit-entry-date",
      );
      this._otherSubTime = this._createInteractiveEntry(
        "14:30",
        "audit-entry-time",
      );
      this._otherSubTz = this._createInteractiveEntry("UTC", "audit-entry-tz");
      row3Other.add_child(
        new St.Label({ text: "Time: ", y_align: Clutter.ActorAlign.CENTER }),
      );
      row3Other.add_child(this._otherSubDate);
      row3Other.add_child(this._otherSubTime);
      row3Other.add_child(this._otherSubTz);
      box3.add_child(row3Other);

      box3.add_child(
        new St.Label({
          text: "My Submission Time:",
          style_class: "audit-field-label",
        }),
      );
      const row3My = new St.BoxLayout({ style_class: "audit-input-row" });
      this._mySubDate = this._createInteractiveEntry(
        "2026-09-10",
        "audit-entry-date",
      );
      this._mySubTime = this._createInteractiveEntry(
        "15:15",
        "audit-entry-time",
      );
      this._mySubTz = this._createInteractiveEntry("WAT", "audit-entry-tz");
      row3My.add_child(
        new St.Label({ text: "Time: ", y_align: Clutter.ActorAlign.CENTER }),
      );
      row3My.add_child(this._mySubDate);
      row3My.add_child(this._mySubTime);
      row3My.add_child(this._mySubTz);
      box3.add_child(row3My);

      const btn3 = this._createInteractiveButton(
        "Compare Submissions",
        "audit-countdown-button",
        this._onCompareSubmissions,
      );
      box3.add_child(btn3);

      this._compareResultsBox = new St.BoxLayout({
        vertical: true,
        style_class: "audit-results-box",
      });
      box3.add_child(this._compareResultsBox);

      const item3 = new PopupMenu.PopupBaseMenuItem({ reactive: false });
      item3.add_child(box3);
      this._menu3.menu.addMenuItem(item3);

      // ==========================================
      // MENU 4: Vulnerability Time Snapshots
      // ==========================================
      this._menu4 = new PopupMenu.PopupSubMenuMenuItem(
        "4. Vulnerability Snapshots Log",
      );
      this.menu.addMenuItem(this._menu4);

      const box4 = new St.BoxLayout({
        vertical: true,
        style_class: "audit-section-box",
      });
      box4.add_child(
        new St.Label({
          text: "Vulnerability Name / Bug ID:",
          style_class: "audit-field-label",
        }),
      );

      this._vulnNameEntry = this._createInteractiveEntry(
        "e.g. Reentrancy in withdraw()",
        "audit-entry-wide",
      );
      box4.add_child(this._vulnNameEntry);

      const btnSnap = this._createInteractiveButton(
        "Take Snapshot (Now)",
        "audit-countdown-button",
        this._onTakeSnapshot,
      );
      box4.add_child(btnSnap);

      const btnClear = this._createInteractiveButton(
        "Clear Snapshots",
        "audit-danger-button",
        () => {
          this._snapshots = [];
          this._renderSnapshots();
          this._saveConfig();
        },
      );
      box4.add_child(btnClear);

      const scrollWrapper = new St.BoxLayout({
        vertical: true,
        style_class: "audit-scroll-wrapper",
      });
      const scrollContainer = new St.ScrollView({
        style_class: "audit-results-box",
        hscrollbar_policy: St.PolicyType.NEVER,
        vscrollbar_policy: St.PolicyType.AUTOMATIC,
      });
      this._snapshotListBox = new St.BoxLayout({ vertical: true });
      scrollContainer.add_child(this._snapshotListBox);
      scrollWrapper.add_child(scrollContainer);
      box4.add_child(scrollWrapper);

      const item4 = new PopupMenu.PopupBaseMenuItem({ reactive: false });
      item4.add_child(box4);
      this._menu4.menu.addMenuItem(item4);
    }

    _onCancelAudit() {
      this._myActiveStart = null;
      this._targetEndDate = null;

      if (this._autoResultsBox) this._autoResultsBox.destroy_all_children();
      if (this._compareResultsBox)
        this._compareResultsBox.destroy_all_children();

      this.updateCountdown();
      this._saveConfig();
    }

    _onTakeSnapshot() {
      const vulnName =
        this._vulnNameEntry.get_text().trim() || "Unnamed Vulnerability";
      const now = GLib.DateTime.new_now_local();

      let elapsedStr = "N/A";
      if (this._myActiveStart) {
        const elapsedSec = now.difference(this._myActiveStart) / 1000000;
        elapsedStr = formatDuration(elapsedSec);
      }

      const origTzStr = this._origTz.get_text().trim() || "UTC";
      const snapshotObj = {
        name: vulnName,
        unixTime: now.to_unix(),
        formattedTime: formatDualTime(now, origTzStr),
        elapsed: elapsedStr,
      };

      this._snapshots.unshift(snapshotObj);
      this._vulnNameEntry.set_text("");
      this._renderSnapshots();
      this._saveConfig();

      const copyText = `[SNAPSHOT] ${vulnName} | Time: ${snapshotObj.formattedTime} | Elapsed: ${elapsedStr}`;
      try {
        St.Clipboard.get_default().set_text(
          St.ClipboardType.CLIPBOARD,
          copyText,
        );
      } catch (err) {
        console.error("AuditCountdown: Failed to copy to clipboard", err);
      }
    }

    _renderSnapshots() {
      this._snapshotListBox.destroy_all_children();
      if (this._snapshots.length === 0) {
        this._snapshotListBox.add_child(
          new St.Label({
            text: "No snapshots recorded yet.",
            style_class: "audit-result-text",
          }),
        );
        return;
      }

      this._snapshots.forEach((snap) => {
        const rowBox = new St.BoxLayout({
          vertical: true,
          style_class: "audit-snapshot-item",
        });
        rowBox.add_child(
          new St.Label({
            text: `🐞 ${snap.name}`,
            style_class: "audit-result-highlight",
          }),
        );
        rowBox.add_child(
          new St.Label({
            text: `   Time: ${snap.formattedTime}`,
            style_class: "audit-result-text",
          }),
        );
        rowBox.add_child(
          new St.Label({
            text: `   Elapsed from start: ${snap.elapsed}`,
            style_class: "audit-result-text",
          }),
        );
        this._snapshotListBox.add_child(rowBox);
      });
    }

    _onSaveCustomSchedule() {
      this._updateAuditName();

      const startDateText = this._cStartDate.get_text().trim();
      const startTimeText = this._cStartTime.get_text().trim() || "00:00";
      const startTzText = this._cStartTz.get_text().trim() || "WAT";

      const endDateText = this._cEndDate.get_text().trim();
      const endTimeText = this._cEndTime.get_text().trim() || "23:59";
      const endTzText = this._cEndTz.get_text().trim() || "WAT";

      const startDt = createDateTime(startDateText, startTimeText, startTzText);
      const endDt = createDateTime(endDateText, endTimeText, endTzText);

      if (startDt && endDt) {
        this._myActiveStart = startDt;
        this._targetEndDate = endDt;
        this.updateCountdown();
      } else {
        if (this._label) {
          this._label.set_text(`${this._auditName}: Invalid Custom Dates!`);
        }
        console.error(
          "AuditCountdown: Invalid Custom Schedule dates provided.",
        );
      }
      this._saveConfig();
    }

    _onStartAutoSchedule() {
      this._updateAuditName();
      const origStart = createDateTime(
        this._origStartDate.get_text().trim(),
        this._origStartTime.get_text().trim(),
        this._origTz.get_text().trim() || "UTC",
      );
      const origEnd = createDateTime(
        this._origEndDate.get_text().trim(),
        this._origEndTime.get_text().trim(),
        this._origTz.get_text().trim() || "UTC",
      );

      this._autoResultsBox.destroy_all_children();

      if (origStart && origEnd) {
        const origDurationSec = origEnd.difference(origStart) / 1000000;
        const sysStart = GLib.DateTime.new_now_local();
        const calcEnd = sysStart.add_seconds(origDurationSec);

        this._myActiveStart = sysStart;
        this._targetEndDate = calcEnd;

        const origTzStr = this._origTz.get_text().trim() || "UTC";

        this._autoResultsBox.add_child(
          new St.Label({
            text: `Recorded Start: ${sysStart.format("%Y-%m-%d %H:%M %Z")}`,
            style_class: "audit-result-text",
          }),
        );
        this._autoResultsBox.add_child(
          new St.Label({
            text: `Calculated End: ${formatDualTime(calcEnd, origTzStr)}`,
            style_class: "audit-result-text",
          }),
        );

        this.updateCountdown();
      } else {
        this._autoResultsBox.add_child(
          new St.Label({
            text: `Error: Invalid original dates.`,
            style_class: "audit-result-text",
          }),
        );
      }
      this._saveConfig();
    }

    _onCompareSubmissions() {
      this._updateAuditName();
      this._compareResultsBox.destroy_all_children();

      const origStart = createDateTime(
        this._origStartDate.get_text().trim(),
        this._origStartTime.get_text().trim(),
        this._origTz.get_text().trim() || "UTC",
      );
      const otherSub = createDateTime(
        this._otherSubDate.get_text().trim(),
        this._otherSubTime.get_text().trim(),
        this._otherSubTz.get_text().trim() || "UTC",
      );
      const mySub = createDateTime(
        this._mySubDate.get_text().trim(),
        this._mySubTime.get_text().trim(),
        this._mySubTz.get_text().trim() || "WAT",
      );

      const addRes = (text, style = "audit-result-text") => {
        this._compareResultsBox.add_child(
          new St.Label({ text: text, style_class: style }),
        );
      };

      let subDuration = 0,
        myDuration = 0;
      let subValid = false,
        myValid = false;

      if (otherSub && origStart) {
        subDuration = otherSub.difference(origStart) / 1000000;
        addRes(`Submitter's Elapsed: ${formatDuration(subDuration)}`);
        subValid = true;
      } else {
        addRes(`Submitter's Elapsed: Invalid input dates`);
      }

      if (mySub && this._myActiveStart) {
        myDuration = mySub.difference(this._myActiveStart) / 1000000;
        addRes(`Your Elapsed Time: ${formatDuration(myDuration)}`);
        myValid = true;
      } else {
        addRes(`Your Elapsed Time: Pending (No active start or invalid date)`);
      }

      if (subValid && myValid) {
        this._compareResultsBox.add_child(new St.Label({ text: " " }));
        const diff = myDuration - subDuration;

        if (diff > 0) {
          addRes(
            `Result: You took ${formatDuration(diff)} LONGER.`,
            "audit-result-text",
          );
        } else if (diff < 0) {
          addRes(
            `Result: You were ${formatDuration(-diff)} FASTER.`,
            "audit-result-highlight",
          );
        } else {
          addRes(
            `Result: You took the exact same duration.`,
            "audit-result-text",
          );
        }
      }

      this._saveConfig();
    }

    _updateAuditName() {
      const text = this._nameEntry.get_text().trim();
      if (text) this._auditName = text;
    }

    updateCountdown() {
      if (!this._label || !this._label.get_stage()) return;

      if (!this._targetEndDate) {
        this._label.set_text(`${this._auditName}: No tracking active`);
        return;
      }

      const now = GLib.DateTime.new_now_local();
      const diffSec = this._targetEndDate.difference(now) / 1000000;

      if (diffSec <= 0) {
        this._label.set_text(`${this._auditName}: Time is up!`);
        return;
      }

      this._label.set_text(
        `${this._auditName}: ${formatDuration(diffSec)} left`,
      );
    }

    _startTimer() {
      this.updateCountdown();
      if (this._timerId === 0) {
        this._timerId = GLib.timeout_add_seconds(
          GLib.PRIORITY_DEFAULT,
          5,
          () => {
            this.updateCountdown();
            return GLib.SOURCE_CONTINUE;
          },
        );
      }
    }

    _stopTimer() {
      if (this._timerId !== 0) {
        GLib.Source.remove(this._timerId);
        this._timerId = 0;
      }
    }

    _saveConfig() {
      try {
        const data = JSON.stringify({
          name: this._nameEntry.get_text(),
          cStartDate: this._cStartDate.get_text(),
          cStartTime: this._cStartTime.get_text(),
          cStartTz: this._cStartTz.get_text(),
          cEndDate: this._cEndDate.get_text(),
          cEndTime: this._cEndTime.get_text(),
          cEndTz: this._cEndTz.get_text(),
          origStartDate: this._origStartDate.get_text(),
          origStartTime: this._origStartTime.get_text(),
          origTz: this._origTz.get_text(),
          origEndDate: this._origEndDate.get_text(),
          origEndTime: this._origEndTime.get_text(),
          otherSubDate: this._otherSubDate.get_text(),
          otherSubTime: this._otherSubTime.get_text(),
          otherSubTz: this._otherSubTz.get_text(),
          mySubDate: this._mySubDate.get_text(),
          mySubTime: this._mySubTime.get_text(),
          mySubTz: this._mySubTz.get_text(),
          myActiveStartUnix: this._myActiveStart
            ? this._myActiveStart.to_unix()
            : null,
          myTargetEndUnix: this._targetEndDate
            ? this._targetEndDate.to_unix()
            : null,
          snapshots: this._snapshots,
        });

        const file = Gio.File.new_for_path(CONFIG_PATH);
        file.replace_contents_bytes_async(
          new GLib.Bytes(data),
          null,
          false,
          Gio.FileCreateFlags.NONE,
          null,
          (f, res) => {
            try {
              // FIX: g_file_replace_contents_bytes_async() is finished with
              // replace_contents_finish(), NOT replace_contents_bytes_finish()
              // (that method does not exist and was throwing a TypeError
              // on every single save).
              f.replace_contents_finish(res);
            } catch (err) {
              console.error(
                "AuditCountdown: Failed to finish writing config",
                err,
              );
            }
          },
        );
      } catch (e) {
        console.error("AuditCountdown: Failed to trigger save config", e);
      }
    }

    _loadConfig() {
      try {
        const file = Gio.File.new_for_path(CONFIG_PATH);
        if (!file.query_exists(null)) return;

        file.load_contents_async(null, (obj, res) => {
          try {
            const [success, contents] = obj.load_contents_finish(res);
            if (success) {
              const data = JSON.parse(new TextDecoder().decode(contents));
              if (data.name) this._nameEntry.set_text(data.name);
              if (data.cStartDate) this._cStartDate.set_text(data.cStartDate);
              if (data.cStartTime) this._cStartTime.set_text(data.cStartTime);
              if (data.cStartTz) this._cStartTz.set_text(data.cStartTz);
              if (data.cEndDate) this._cEndDate.set_text(data.cEndDate);
              if (data.cEndTime) this._cEndTime.set_text(data.cEndTime);
              if (data.cEndTz) this._cEndTz.set_text(data.cEndTz);
              if (data.origStartDate)
                this._origStartDate.set_text(data.origStartDate);
              if (data.origStartTime)
                this._origStartTime.set_text(data.origStartTime);
              if (data.origTz) this._origTz.set_text(data.origTz);
              if (data.origEndDate)
                this._origEndDate.set_text(data.origEndDate);
              if (data.origEndTime)
                this._origEndTime.set_text(data.origEndTime);
              if (data.otherSubDate)
                this._otherSubDate.set_text(data.otherSubDate);
              if (data.otherSubTime)
                this._otherSubTime.set_text(data.otherSubTime);
              if (data.otherSubTz) this._otherSubTz.set_text(data.otherSubTz);
              if (data.mySubDate) this._mySubDate.set_text(data.mySubDate);
              if (data.mySubTime) this._mySubTime.set_text(data.mySubTime);
              if (data.mySubTz) this._mySubTz.set_text(data.mySubTz);

              if (data.myActiveStartUnix) {
                this._myActiveStart = GLib.DateTime.new_from_unix_local(
                  data.myActiveStartUnix,
                );
              }
              if (data.myTargetEndUnix) {
                this._targetEndDate = GLib.DateTime.new_from_unix_local(
                  data.myTargetEndUnix,
                );
              }
              if (data.snapshots && Array.isArray(data.snapshots)) {
                this._snapshots = data.snapshots;
                this._renderSnapshots();
              }

              this._updateAuditName();
              this.updateCountdown();
            }
          } catch (e) {
            console.error("AuditCountdown: Failed to parse loaded config", e);
          }
        });
      } catch (e) {
        console.error("AuditCountdown: Failed to initiate config load", e);
      }
    }

    destroy() {
      this._stopTimer();
      super.destroy();
    }
  },
);

export default class AuditCountdownExtension extends Extension {
  enable() {
    this._indicator = new AuditIndicator();
    Main.panel.addToStatusArea(this.uuid, this._indicator);
  }

  disable() {
    if (this._indicator) {
      this._indicator.destroy();
      this._indicator = null;
    }
  }
}
