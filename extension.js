import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';
import Gio from 'gi://Gio';

import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const CONFIG_PATH = GLib.get_user_config_dir() + '/audit-countdown.json';

const AuditIndicator = GObject.registerClass(
class AuditIndicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, 'Audit Countdown Indicator');

        this._label = new St.Label({
            text: '0 days 0 hours',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'audit-countdown-label'
        });
        this.add_child(this._label);

        this._auditName = 'Security Audit';
        this._targetDate = null;
        this._timerId = 0;

        this._buildMenu();
        this._loadConfig();
        this._startTimer();
    }

    _buildMenu() {
        const headerItem = new PopupMenu.PopupMenuItem('Audit Countdown Settings', { reactive: false });
        this.menu.addMenuItem(headerItem);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // 1. Audit Name Input
        const nameBox = new St.BoxLayout({ vertical: true, x_expand: true, style_class: 'audit-countdown-box' });
        nameBox.add_child(new St.Label({ text: 'Audit Name / Details:', style_class: 'audit-countdown-label' }));
        
        this._nameEntry = new St.Entry({
            hint_text: 'e.g. Protocol Security Audit',
            can_focus: true,
            reactive: true,
            x_expand: true,
        });
        nameBox.add_child(this._nameEntry);

        const nameMenuItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        nameMenuItem.add_child(nameBox);
        this.menu.addMenuItem(nameMenuItem);

        // 2. Date Input
        const dateBox = new St.BoxLayout({ vertical: true, x_expand: true, style_class: 'audit-countdown-box' });
        dateBox.add_child(new St.Label({ text: 'Date (YYYY-MM-DD):', style_class: 'audit-countdown-label' }));
        
        this._dateEntry = new St.Entry({
            hint_text: '2026-09-30',
            can_focus: true,
            reactive: true,
            x_expand: true,
        });
        dateBox.add_child(this._dateEntry);

        const dateMenuItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        dateMenuItem.add_child(dateBox);
        this.menu.addMenuItem(dateMenuItem);

        // 3. Time Input (Split Hours & Minutes)
        const timeBox = new St.BoxLayout({ vertical: true, x_expand: true, style_class: 'audit-countdown-box' });
        timeBox.add_child(new St.Label({ text: 'Time (24-hour format):', style_class: 'audit-countdown-label' }));

        const timeInputRow = new St.BoxLayout({ vertical: false, style_class: 'time-input-row' });
        
        this._hourEntry = new St.Entry({
            hint_text: '18',
            can_focus: true,
            reactive: true,
            style_class: 'time-entry'
        });
        timeInputRow.add_child(this._hourEntry);

        timeInputRow.add_child(new St.Label({ text: ' : ', y_align: Clutter.ActorAlign.CENTER, style_class: 'time-separator' }));

        this._minuteEntry = new St.Entry({
            hint_text: '30',
            can_focus: true,
            reactive: true,
            style_class: 'time-entry'
        });
        timeInputRow.add_child(this._minuteEntry);
        
        timeBox.add_child(timeInputRow);

        const timeMenuItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        timeMenuItem.add_child(timeBox);
        this.menu.addMenuItem(timeMenuItem);

        // 4. Save Button
        const saveButton = new St.Button({
            label: 'Save & Start Countdown',
            style_class: 'audit-countdown-button',
            can_focus: true,
            reactive: true,
            x_expand: true,
        });
        saveButton.connect('clicked', () => this._onSaveClicked());

        const buttonMenuItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        buttonMenuItem.add_child(saveButton);
        this.menu.addMenuItem(buttonMenuItem);
    }

    _onSaveClicked() {
        const nameText = this._nameEntry.get_text().trim();
        const dateText = this._dateEntry.get_text().trim();
        const hourText = this._hourEntry.get_text().trim() || '00';
        const minuteText = this._minuteEntry.get_text().trim() || '00';

        if (nameText) this._auditName = nameText;

        // Parse Date (YYYY-MM-DD)
        const dateMatch = dateText.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!dateMatch) {
            this._label.set_text('Invalid Date! Use YYYY-MM-DD');
            return;
        }

        const year = parseInt(dateMatch[1], 10);
        const month = parseInt(dateMatch[2], 10) - 1; // Months are 0-indexed in JS
        const day = parseInt(dateMatch[3], 10);
        
        // Parse Time
        const hour = parseInt(hourText, 10);
        const minute = parseInt(minuteText, 10);

        if (isNaN(hour) || hour < 0 || hour > 23 || isNaN(minute) || minute < 0 || minute > 59) {
            this._label.set_text('Invalid Time! Use 00-23 and 00-59');
            return;
        }

        this._targetDate = new Date(year, month, day, hour, minute, 0);
        this._saveConfig(nameText, dateText, hourText, minuteText);
        
        this.updateCountdown();
        this.menu.close();
    }

    updateCountdown() {
        if (!this._label || !this._label.get_stage()) return;

        if (!this._targetDate) {
            this._label.set_text('0 days 0 hours');
            return;
        }

        const now = new Date().getTime();
        const diff = this._targetDate.getTime() - now;

        if (diff <= 0) {
            this._label.set_text(`${this._auditName}: Time is up!`);
            return;
        }

        const totalSeconds = Math.floor(diff / 1000);
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);

        // Handle pluralization dynamically
        const dStr = days === 1 ? 'day' : 'days';
        const hStr = hours === 1 ? 'hour' : 'hours';
        const mStr = minutes === 1 ? 'minute' : 'minutes';

        if (days >= 1) {
            this._label.set_text(`${this._auditName}: ${days} ${dStr} ${hours} ${hStr}`);
        } else {
            this._label.set_text(`${this._auditName}: ${hours} ${hStr} ${minutes} ${mStr}`);
        }
    }

    _startTimer() {
        this.updateCountdown();
        if (this._timerId === 0) {
            this._timerId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 5, () => {
                this.updateCountdown();
                return GLib.SOURCE_CONTINUE;
            });
        }
    }

    _stopTimer() {
        if (this._timerId !== 0) {
            GLib.Source.remove(this._timerId);
            this._timerId = 0;
        }
    }

    _saveConfig(name, date, hour, minute) {
        try {
            const data = JSON.stringify({ name, date, hour, minute });
            const file = Gio.File.new_for_path(CONFIG_PATH);
            file.replace_contents_bytes_async(
                new GLib.Bytes(data), null, false, Gio.FileCreateFlags.NONE, null, null
            );
        } catch (e) {
            logError(e, 'Failed to save audit countdown config');
        }
    }

    _loadConfig() {
        try {
            const file = Gio.File.new_for_path(CONFIG_PATH);
            if (!file.query_exists(null)) return;

            file.load_contents_async(null, (obj, res) => {
                try {
                    const [success, contents] = file.load_contents_finish(res);
                    if (success) {
                        const data = JSON.parse(new TextDecoder().decode(contents));
                        
                        if (data.name) {
                            this._auditName = data.name;
                            this._nameEntry.set_text(data.name);
                        }
                        
                        if (data.date) {
                            this._dateEntry.set_text(data.date);
                            this._hourEntry.set_text(data.hour || '00');
                            this._minuteEntry.set_text(data.minute || '00');
                            
                            const parts = data.date.split('-');
                            if (parts.length === 3) {
                                this._targetDate = new Date(
                                    parseInt(parts[0], 10), 
                                    parseInt(parts[1], 10) - 1, 
                                    parseInt(parts[2], 10),
                                    parseInt(data.hour || 0, 10),
                                    parseInt(data.minute || 0, 10),
                                    0
                                );
                                this.updateCountdown();
                            }
                        }
                    }
                } catch (e) {
                    logError(e, 'Failed to parse audit countdown config');
                }
            });
        } catch (e) {
            logError(e, 'Failed to load audit countdown config');
        }
    }

    destroy() {
        this._stopTimer();
        super.destroy();
    }
});

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
