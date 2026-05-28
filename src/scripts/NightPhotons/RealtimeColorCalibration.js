#engine v8

#feature-id    RealtimeColorCalibration : NightPhotons > RealtimeColorCalibration
#feature-icon  @script_icons_dir/RealtimeColorCalibration.svg
#feature-info  An interactive image preview with adjustable white balance, stretch, and saturation.

CoreApplication.ensureMinimumVersion( 1, 9, 4 );

#include <pjsr/controls/ImageView.js>

#define TITLE   "RealtimeColorCalibration"
#define VERSION "1.0.0"


var MainDialog = class extends Dialog {
    constructor() {
        super();
        var dlg = this;

        this.windowTitle = TITLE;

        // Defaults
        this.currentView = null;
        this.bgRefView = null;
        this.rWeight = 1.0;
        this.gWeight = 1.0;
        this.bWeight = 1.0;
        this.applySTF = true;
        this.midtones = 0.5;
        this.saturation = 1.0;
        this.neutralizeBg = true;
        this.applyToMainView = true

        this._renderPending = false;
        this._renderGen = 0;

        this.debounceTimer = new Timer(0.4, false);
        this.debounceTimer.onTimeout = function () {
            if (!dlg._renderPending) return;
            dlg._renderPending = false;
            dlg.updatePreview();
        };

        this.debouncedUpdate = function () {
            this._renderPending = true;
            this._renderGen++;
            this.debounceTimer.stop();
            this.debounceTimer.start();
        };

        // -------------------------------------------------------------------------
        // Dialog
        // -------------------------------------------------------------------------

        var viewLabelWidth = this.font.width("Background Reference: ");
        var wbLabelWidth = this.font.width("Green: ");
        var panelWidth = this.font.width("<p><b>" + TITLE + " v" + VERSION + "</b> | Charles Hagen</p>");

        // Description & Title
        this.label = new Label(this);
        this.label.wordWrapping = true;
        this.label.useRichText = true;
        this.label.margin = 4;
        this.label.text = "<p><b>" + TITLE + " v" + VERSION + "</b> | Charles Hagen</p>"
            + "<p>Provide a primary image or preview and a background reference image or preview to apply background neutralization and "
            + "manual color calibration with a real-time preview, stf stretch, midtones transform, and saturation. If no background "
            + "reference is provided, the median of the primary image will be used as the neutral point. Once the adjustments are complete, "
            + "press the Apply button to apply only the white balance and background neutralization to the target image.</p>"
            + "<p><i>Create a process icon with the new instance button to launch the dialog on the active image.</i></p>";

        // Views Group
        this.source_Label = new Label(this);
        this.source_Label.text = "Source View:";
        this.source_Label.minWidth = viewLabelWidth;
        this.source_Label.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;

        this.source_List = new ViewList(this);
        this.source_List.getAll();
        this.source_List.toolTip = "<p>Select an open view to display in the preview.</p>";
        this.source_List.onViewSelected = function (view) {
            if (view.isNull) {
                dlg.bgRefView = null; 
                return;
            }
            if (view.image.isColor) {
                dlg.currentView = view;
                if (view.isPreview) {
                    view.historyIndex = 0;
                }
                dlg.debouncedUpdate();
            } else {
                console.warningln("Warning: Color calibration can only be performed on color images. Please select a color image.");
                console.show();
            }
        };

        this.source_Sizer = new HorizontalSizer;
        this.source_Sizer.spacing = 6;
        this.source_Sizer.add(this.source_Label);
        this.source_Sizer.add(this.source_List, 100);

        this.bgRef_Label = new Label(this);
        this.bgRef_Label.text = "Background Reference:";
        this.bgRef_Label.minWidth = viewLabelWidth;
        this.bgRef_Label.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;

        this.bgRef_List = new ViewList(this);
        this.bgRef_List.getAll();
        this.bgRef_List.toolTip = "<p>Background reference view for preserving neutral backgrounds after color calibration.</p>";
        this.bgRef_List.onViewSelected = function (view) {
            if (view.isNull) {
                dlg.bgRefView = null; 
                dlg.debouncedUpdate();
                return;
            }
            if (view.image.isColor) {
                dlg.bgRefView = view;
                if (view.isPreview) {
                    view.historyIndex = 0;
                }
                dlg.debouncedUpdate();
            } else {
                console.warningln("Warning: Background reference must be a color image. Please select a color image.");
                console.show();
            }
        };

        this.bgRef_Sizer = new HorizontalSizer;
        this.bgRef_Sizer.spacing = 6;
        this.bgRef_Sizer.add(this.bgRef_Label);
        this.bgRef_Sizer.add(this.bgRef_List, 100);

        this.views_Group = new GroupBox(this);
        this.views_Group.title = "Views";
        this.views_Group.sizer = new VerticalSizer;
        this.views_Group.sizer.margin = 6;
        this.views_Group.sizer.spacing = 4;
        this.views_Group.sizer.add(this.source_Sizer);
        this.views_Group.sizer.add(this.bgRef_Sizer);

        // White Balance Group
        this.neutralizeBg_Check = new CheckBox(this);
        this.neutralizeBg_Check.text = "Neutralize Background";
        this.neutralizeBg_Check.checked = this.neutralizeBg;
        this.neutralizeBg_Check.toolTip = "<p>When enabled, all channels add back the minimum of the three "
            + "reference channel medians instead of each channel's own median, neutralizing the background color.</p>";
        this.neutralizeBg_Check.onCheck = function (checked) {
            dlg.neutralizeBg = checked;
            dlg.debouncedUpdate();
        };

        this.red_Control = new NumericControl(this);
        this.red_Control.label.text = "Red:";
        this.red_Control.label.minWidth = wbLabelWidth;
        this.red_Control.setRange(0, 1);
        this.red_Control.setPrecision(2);
        this.red_Control.slider.setRange(0, 100);
        this.red_Control.setValue(this.rWeight);
        this.red_Control.toolTip = "<p>Red channel weight multiplier (0–1).</p>";
        this.red_Control.onValueUpdated = function (value) {
            dlg.rWeight = value;
            dlg.debouncedUpdate();
        };

        this.green_Control = new NumericControl(this);
        this.green_Control.label.text = "Green:";
        this.green_Control.label.minWidth = wbLabelWidth;
        this.green_Control.setRange(0, 1);
        this.green_Control.setPrecision(2);
        this.green_Control.slider.setRange(0, 100);
        this.green_Control.setValue(this.gWeight);
        this.green_Control.toolTip = "<p>Green channel weight multiplier (0–1).</p>";
        this.green_Control.onValueUpdated = function (value) {
            dlg.gWeight = value;
            dlg.debouncedUpdate();
        };

        this.blue_Control = new NumericControl(this);
        this.blue_Control.label.text = "Blue:";
        this.blue_Control.label.minWidth = wbLabelWidth;
        this.blue_Control.setRange(0, 1);
        this.blue_Control.setPrecision(2);
        this.blue_Control.slider.setRange(0, 100);
        this.blue_Control.setValue(this.bWeight);
        this.blue_Control.toolTip = "<p>Blue channel weight multiplier (0–1).</p>";
        this.blue_Control.onValueUpdated = function (value) {
            dlg.bWeight = value;
            dlg.debouncedUpdate();
        };


        this.wb_Group = new GroupBox(this);
        this.wb_Group.title = "White Balance";
        this.wb_Group.sizer = new VerticalSizer;
        this.wb_Group.sizer.margin = 6;
        this.wb_Group.sizer.spacing = 4;
        this.wb_Group.sizer.add(this.neutralizeBg_Check);
        this.wb_Group.sizer.addSpacing(4);
        this.wb_Group.sizer.add(this.red_Control);
        this.wb_Group.sizer.add(this.green_Control);
        this.wb_Group.sizer.add(this.blue_Control);

        // Stretch Group
        this.applySTF_Check = new CheckBox(this);
        this.applySTF_Check.text = "Apply Linked STF";
        this.applySTF_Check.checked = true;
        this.applySTF_Check.toolTip = "<p>Compute and apply a linked auto-STF stretch. "
            + "Statistics are drawn from the Background Reference view if one is selected.</p>";
        this.applySTF_Check.onCheck = function (checked) {
            dlg.applySTF = checked;
            dlg.debouncedUpdate();
        };

        this.midtones_Control = new NumericControl(this);
        this.midtones_Control.label.text = "Midtones:";
        this.midtones_Control.setRange(0.05, 0.95);
        this.midtones_Control.setPrecision(2);
        this.midtones_Control.slider.setRange(0, 900);
        this.midtones_Control.setValue(this.midtones);
        this.midtones_Control.toolTip = "<p>Additional midtones adjustment applied after the STF stretch. "
            + "0.5 is neutral.</p>";
        this.midtones_Control.onValueUpdated = function (value) {
            dlg.midtones = value;
            dlg.debouncedUpdate();
        };

        this.stretch_Group = new GroupBox(this);
        this.stretch_Group.title = "Stretch";
        this.stretch_Group.sizer = new VerticalSizer;
        this.stretch_Group.sizer.margin = 6;
        this.stretch_Group.sizer.spacing = 4;
        this.stretch_Group.sizer.add(this.applySTF_Check);
        this.stretch_Group.sizer.add(this.midtones_Control);

        // Saturation Group 
        this.sat_Control = new NumericControl(this);
        this.sat_Control.label.text = "Saturation:";
        this.sat_Control.setRange(1, 2.5);
        this.sat_Control.setPrecision(2);
        this.sat_Control.setValue(this.saturation);
        this.sat_Control.slider.setRange(0, 150);
        this.sat_Control.toolTip = "<p>Slope of the CIE c* (chroma) curve applied via CurvesTransformation.</p>";
        this.sat_Control.onValueUpdated = function (value) {
            dlg.saturation = value;
            dlg.debouncedUpdate();
        };

        this.sat_Group = new GroupBox(this);
        this.sat_Group.title = "Saturation";
        this.sat_Group.sizer = new VerticalSizer;
        this.sat_Group.sizer.margin = 6;
        this.sat_Group.sizer.add(this.sat_Control);

        // Settings Group
        this.applyToMainView_Check = new CheckBox(this);
        this.applyToMainView_Check.text = "Apply to Main View";
        this.applyToMainView_Check.checked = true;
        this.applyToMainView_Check.toolTip = "<p>If the source view is a preview, apply the color calibration to its parent, the main view.</p>";
        this.applyToMainView_Check.onCheck = function (checked) {
            dlg.applyToMainView = checked;
        };

        this.settings_Group = new GroupBox(this);
        this.settings_Group.title = "Settings";
        this.settings_Group.sizer = new VerticalSizer;
        this.settings_Group.sizer.margin = 6;
        this.settings_Group.sizer.add(this.applyToMainView_Check);
        this.settings_Group.sizer.addSpacing(4);

        // -------------------------------------------------------------------------
        // Bottom button row
        // -------------------------------------------------------------------------

        this.newInstance_Button = new ToolButton(this);
        this.newInstance_Button.icon = this.scaledResource(":/process-interface/new-instance.png");
        this.newInstance_Button.setScaledFixedSize(20, 20);
        this.newInstance_Button.toolTip = "<p>Create a process icon for this script.</p>";
        this.newInstance_Button.onMousePress = function () {
            this.hasFocus = true;
            this.pushed = false;
            this.dialog.newInstance();
        };

        this.apply_Button = new PushButton(this);
        this.apply_Button.text = "Apply";
        this.apply_Button.icon = this.scaledResource(":/icons/ok.png");
        this.apply_Button.toolTip = "<p>Apply the white balance and background neutralization to the source view. "
            + "STF, midtones, and saturation are not applied.</p>";
        this.apply_Button.onClick = function () { 
            dlg.applyWhiteBalance(); 
            this.dialog.ok();
        };

        this.refresh_Button = new PushButton(this);
        this.refresh_Button.text = "Refresh";
        this.refresh_Button.icon = this.scaledResource(":/icons/reload.png");
        this.refresh_Button.toolTip = "<p>Re-render the selected view immediately.</p>";
        this.refresh_Button.onClick = function () {
            dlg.debounceTimer.stop();
            dlg.updatePreview();
        };

        this.close_Button = new PushButton(this);
        this.close_Button.defaultButton = true;
        this.close_Button.text = "Close";
        this.close_Button.icon = this.scaledResource(":/icons/close.png");
        this.close_Button.onClick = function () { this.dialog.ok(); };

        this.buttons_Sizer = new HorizontalSizer;
        this.buttons_Sizer.spacing = 6;
        this.buttons_Sizer.add(this.newInstance_Button);
        this.buttons_Sizer.addStretch();
        this.buttons_Sizer.add(this.apply_Button);
        this.buttons_Sizer.add(this.refresh_Button);
        this.buttons_Sizer.add(this.close_Button);

        // Left panel sizer
        this.left_Sizer = new VerticalSizer;
        this.left_Sizer.spacing = 6;
        this.left_Sizer.add(this.label);
        this.left_Sizer.add(this.views_Group);
        this.left_Sizer.add(this.wb_Group);
        this.left_Sizer.add(this.stretch_Group);
        this.left_Sizer.add(this.sat_Group);
        this.left_Sizer.add(this.settings_Group);
        this.left_Sizer.addStretch();

        // Preview
        this.previewControl = new ImageView(this);
        this.onClose = function () {
            this.debounceTimer.stop();
            this.previewControl.reset();
            return true;
        };

        this.preview_Group = new GroupBox(this);
        this.preview_Group.title = "Real-time Preview";
        this.preview_Group.sizer = new VerticalSizer;
        this.preview_Group.sizer.margin = 6;
        this.preview_Group.sizer.spacing = 4;
        this.preview_Group.sizer.add(this.previewControl);

        // Full dialog sizer
        this.content_sizer = new HorizontalSizer;
        this.content_sizer.margin = 8;
        this.content_sizer.spacing = 8;
        this.content_sizer.add(this.left_Sizer);
        this.content_sizer.add(this.preview_Group, 120);

        this.sizer = new VerticalSizer;
        this.sizer.margin = 8;
        this.sizer.spacing = 8
        this.sizer.add(this.content_sizer);
        this.sizer.add(this.buttons_Sizer);



        this.ensureLayoutUpdated();
        this.resize(this.logicalPixelsToPhysical(1400), this.logicalPixelsToPhysical(900));

        this.executeWhiteBalance = function (targetView) {
            let refImg  = (this.bgRefView && !this.bgRefView.isNull)
                          ? this.bgRefView.image : this.currentView.image;
            let refRect = new Rect(0, 0, refImg.width, refImg.height);
            let nRefCh  = refImg.isColor ? 3 : 1;
            let medR    = refImg.median(refRect, 0, 0);
            let medG    = (nRefCh > 1) ? refImg.median(refRect, 1, 1) : medR;
            let medB    = (nRefCh > 2) ? refImg.median(refRect, 2, 2) : medR;

            let addBack = this.neutralizeBg ? Math.min(medR, medG, medB) : null;
            let addR = addBack !== null ? addBack : medR;
            let addG = addBack !== null ? addBack : medG;
            let addB = addBack !== null ? addBack : medB;

            let pm = new PixelMath;
            pm.expression0         = format("($T - %.6f)*%.6f + %.6f", medR, this.rWeight, addR);
            pm.expression1         = format("($T - %.6f)*%.6f + %.6f", medG, this.gWeight, addG);
            pm.expression2         = format("($T - %.6f)*%.6f + %.6f", medB, this.bWeight, addB);
            pm.useSingleExpression = false;
            pm.generateOutput      = true;
            pm.optimization        = true;
            pm.rescale             = false;
            pm.truncate            = true;
            pm.truncateLower       = 0;
            pm.truncateUpper       = 1;
            pm.createNewImage      = false;
            pm.executeOn(targetView);
        };

        this.updatePreview = function () {
            let view = this.currentView;
            if (!view || view.isNull || view.image.isEmpty)
                return;

            let gen = this._renderGen;
            let img = view.image;
            let tempWindow = null;

            try {
                tempWindow = new ImageWindow(img.width, img.height, img.numberOfChannels,
                    32, true, img.isColor, "_rp_preview_tmp");
                let tempView = tempWindow.mainView;

                tempView.beginProcess(UndoFlag.NoSwapFile);
                tempView.image.assign(img);
                tempView.endProcess();

                if (this._renderGen !== gen) return;

                // White balance
                if (img.isColor && (this.rWeight !== 1.0 || this.gWeight !== 1.0 || this.bWeight !== 1.0) || this.neutralizeBg)
                    this.executeWhiteBalance(tempView);

                if (this._renderGen !== gen) return;

                // Linked STF stretch
                if (this.applySTF) {
                    let statsImg = tempView.image;
                    let rect = new Rect(0, 0, statsImg.width, statsImg.height);
                    let nch = statsImg.isColor ? 3 : 1;
                    let totalMed = 0, totalMad = 0;
                    for (let c = 0; c < nch; ++c) {
                        let med = statsImg.median(rect, c, c);
                        totalMed += med;
                        totalMad += statsImg.medianAbsoluteDeviation(med, rect, c, c);
                    }
                    let avgMed = totalMed / nch;
                    let avgMad = totalMad / nch;
                    let sig = 1.4826 * avgMad;
                    let sc = Math.max(0, avgMed - 2.8 * sig);
                    let nm = (1 - sc > 1e-10) ? (avgMed - sc) / (1 - sc) : 0;
                    let mt = (nm > 0) ? mtf(0.25, nm) : 0.5;

                    let HT = new HistogramTransformation;
                    let H = HT.H;
                    H[3][0] = sc; H[3][1] = mt; H[3][2] = 1;
                    H[3][3] = 0; H[3][4] = 1;
                    HT.H = H;
                    HT.executeOn(tempView);

                    if (this._renderGen !== gen) return;
                }

                // Midtones
                if (this.midtones !== 0.5) {
                    let HT2 = new HistogramTransformation;
                    let H2 = HT2.H;
                    H2[3][0] = 0; H2[3][1] = this.midtones; H2[3][2] = 1;
                    H2[3][3] = 0; H2[3][4] = 1;
                    HT2.H = H2;
                    HT2.executeOn(tempView);

                    if (this._renderGen !== gen) return;
                }

                // Saturation
                if (img.isColor && this.saturation !== 1.0) {
                    let s = this.saturation;
                    let xClip = 1.0 / s;
                    let curves = new CurvesTransformation;
                    curves.c = [[0, 0], [xClip, 1.0], [1.0, 1.0]];
                    curves.ct = CurvesTransformation.Linear;
                    curves.executeOn(tempView);

                    if (this._renderGen !== gen) return;
                }

                let bitmap = tempView.image.render();
                if (this.previewControl.isValid)
                    this.previewControl.regenerate(bitmap);
                else {
                    this.previewControl.setImage(bitmap);
                    this.previewControl.zoomToFit();
                }
                bitmap.clear();
            }
            catch (e) {
                console.criticalln("RealtimeColorCalibration error: " + e);
            }
            finally {
                if (tempWindow && !tempWindow.isNull)
                    tempWindow.forceClose();
            }
        };

        this.applyWhiteBalance = function () {
            let view = this.currentView;
            if (this.currentView.isPreview && this.applyToMainView) {
                view = this.currentView.window.mainView; 
            }

            if (!view || view.isNull || view.image.isEmpty || !view.image.isColor) {
                console.criticalln("Error: Unable to apply white balance!");
                console.show();
                return;
            }

            this.executeWhiteBalance(view);
        };
    }
};

function mtf(m, x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    if (m <= 0) return 0;
    if (m >= 1) return 1;
    return (m - 1) * x / ((2 * m - 1) * x - m);
}

function main() {
    let dlg = new MainDialog();
    var active = ImageWindow.activeWindow.currentView;
    if (active != null && active.image.isColor) {
        dlg.source_List.currentView = active;
        dlg.currentView = active;
        dlg.updatePreview();
    }
    dlg.execute();
}

main();
