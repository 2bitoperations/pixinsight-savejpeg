#include <pjsr/ColorSpace.jsh>
#include <pjsr/NumericControl.jsh>
#include <pjsr/Sizer.jsh>
#include <pjsr/StdButton.jsh>
#include <pjsr/StdIcon.jsh>

#feature-id    Utilities > SaveStretchedJPEG
#feature-info  Saves the active image as a stretched export (JPEG, PNG, or TIFF) using the current STF.

// ─── Format table ─────────────────────────────────────────────────────────────
// Add entries here to support additional formats.
var FORMATS = [
    { label: "JPEG", name: "JPEG", ext: ".jpeg",
      filters: [["JPEG Files", "*.jpeg", "*.jpg"]] },
    { label: "PNG",  name: "PNG",  ext: ".png",
      filters: [["PNG Files",  "*.png"]]           },
    { label: "TIFF", name: "TIFF", ext: ".tiff",
      filters: [["TIFF Files", "*.tiff", "*.tif"]] }
];

// ─── Options dialog ───────────────────────────────────────────────────────────

function SaveImageDialog(sourceWindow, suggestedPath) {
    this.__base__ = Dialog;
    this.__base__();
    var self = this;

    this.windowTitle = "Save Stretched Image";

    // ── Warning ──────────────────────────────────────────────────────────────
    this.warningLabel = new Label(this);
    this.warningLabel.useRichText   = true;
    this.warningLabel.wordWrapping  = true;
    this.warningLabel.minWidth      = 420;
    this.warningLabel.text =
        "<b>Heads up:</b> these exports bake in your current STF stretch and " +
        "reduce the image to 8-bit — what you see is what you get. They are " +
        "great for posting to social media or sending to grandma, but are " +
        "completely unsuitable for archiving, stacking, or sharing with " +
        "anyone who'll want to do further processing.";

    // ── Output path ──────────────────────────────────────────────────────────
    var pathLabel = new Label(this);
    pathLabel.text = "Output path:";

    this.pathEdit = new Edit(this);
    this.pathEdit.minWidth = 360;
    this.pathEdit.text    = suggestedPath;
    this.pathEdit.toolTip = "<p>Full path for the output file.</p>" +
                            "<p>Edit directly, or use Browse to pick a location.</p>";

    this.browseButton = new ToolButton(this);
    this.browseButton.icon = this.scaledResource(":/browser/select-file.png");
    this.browseButton.setScaledFixedSize(20, 20);
    this.browseButton.toolTip = "Browse for output location…";
    this.browseButton.onClick = function() {
        var fmt = FORMATS[self.formatCombo.currentItem];
        var d = new SaveFileDialog;
        d.caption     = "Save Stretched Image As";
        d.filters     = fmt.filters;
        d.initialPath = self.pathEdit.text || (sourceWindow.mainView.id + fmt.ext);
        if (d.execute()) self.pathEdit.text = d.fileName;
    };

    var pathSizer = new HorizontalSizer;
    pathSizer.spacing = 4;
    pathSizer.add(pathLabel);
    pathSizer.add(this.pathEdit, 100);
    pathSizer.add(this.browseButton);

    this.unsavedHint = new Label(this);
    this.unsavedHint.text    = "This image has no source file — use Browse to choose an output location.";
    this.unsavedHint.visible = (suggestedPath === "");

    // ── Format selector ──────────────────────────────────────────────────────
    var formatLabel = new Label(this);
    formatLabel.text = "Format:";

    this.formatCombo = new ComboBox(this);
    for (var i = 0; i < FORMATS.length; i++)
        this.formatCombo.addItem(FORMATS[i].label);
    this.formatCombo.currentItem = 0;
    this.formatCombo.onItemSelected = function(index) {
        var path = self.pathEdit.text;
        if (path !== "")
            self.pathEdit.text = path.replace(/\.[^./\\]+$/, "") + FORMATS[index].ext;
        self.jpegOptions.visible = (index === 0);
        self.pngOptions.visible  = (index === 1);
        self.tiffOptions.visible = (index === 2);
        self.adjustToContents();
    };

    var formatSizer = new HorizontalSizer;
    formatSizer.spacing = 4;
    formatSizer.add(formatLabel);
    formatSizer.add(this.formatCombo);
    formatSizer.addStretch();

    // ── JPEG options ─────────────────────────────────────────────────────────
    this.jpegOptions = new GroupBox(this);
    this.jpegOptions.title   = "JPEG Options";
    this.jpegOptions.visible = true;

    this.jpegQuality = new NumericControl(this.jpegOptions);
    this.jpegQuality.label.text    = "Quality:";
    this.jpegQuality.label.minWidth = 80;
    this.jpegQuality.setRange(1, 100);
    this.jpegQuality.slider.setRange(1, 100);
    this.jpegQuality.slider.minWidth = 220;
    this.jpegQuality.setPrecision(0);
    this.jpegQuality.setValue(95);
    this.jpegQuality.toolTip = "JPEG quality: 1 (worst / smallest) to 100 (best / largest).";

    this.jpegProgressive = new CheckBox(this.jpegOptions);
    this.jpegProgressive.text    = "Progressive scan";
    this.jpegProgressive.checked = false;
    this.jpegProgressive.toolTip = "Write a progressive-scan JPEG (renders in multiple passes; common for web).";

    var jpegSizer = new VerticalSizer;
    jpegSizer.margin  = 6;
    jpegSizer.spacing = 4;
    jpegSizer.add(this.jpegQuality);
    jpegSizer.add(this.jpegProgressive);
    this.jpegOptions.sizer = jpegSizer;

    // ── PNG options ──────────────────────────────────────────────────────────
    this.pngOptions = new GroupBox(this);
    this.pngOptions.title   = "PNG Options";
    this.pngOptions.visible = false;

    this.pngCompression = new NumericControl(this.pngOptions);
    this.pngCompression.label.text     = "Compression:";
    this.pngCompression.label.minWidth = 80;
    this.pngCompression.setRange(0, 9);
    this.pngCompression.slider.setRange(0, 9);
    this.pngCompression.slider.minWidth = 220;
    this.pngCompression.setPrecision(0);
    this.pngCompression.setValue(6);
    this.pngCompression.toolTip =
        "PNG deflate compression level: 0 (none/fastest) to 9 (smallest/slowest). " +
        "PNG is always lossless — this only affects file size and encoding speed.";

    this.pngInterlaced = new CheckBox(this.pngOptions);
    this.pngInterlaced.text    = "Interlaced (Adam7)";
    this.pngInterlaced.checked = false;
    this.pngInterlaced.toolTip = "Write an interlaced PNG — renders progressively in browsers.";

    var pngSizer = new VerticalSizer;
    pngSizer.margin  = 6;
    pngSizer.spacing = 4;
    pngSizer.add(this.pngCompression);
    pngSizer.add(this.pngInterlaced);
    this.pngOptions.sizer = pngSizer;

    // ── TIFF options ─────────────────────────────────────────────────────────
    this.tiffOptions = new GroupBox(this);
    this.tiffOptions.title   = "TIFF Options";
    this.tiffOptions.visible = false;

    var tiffCompLabel = new Label(this.tiffOptions);
    tiffCompLabel.text = "Compression:";

    this.tiffCompression = new ComboBox(this.tiffOptions);
    this.tiffCompression.addItem("None");
    this.tiffCompression.addItem("LZW");
    this.tiffCompression.addItem("ZIP (Deflate)");
    this.tiffCompression.currentItem = 1; // LZW default
    this.tiffCompression.toolTip = "TIFF compression algorithm — all options are lossless.";

    var tiffCompSizer = new HorizontalSizer;
    tiffCompSizer.spacing = 4;
    tiffCompSizer.add(tiffCompLabel);
    tiffCompSizer.add(this.tiffCompression);
    tiffCompSizer.addStretch();

    var tiffSizer = new VerticalSizer;
    tiffSizer.margin  = 6;
    tiffSizer.spacing = 4;
    tiffSizer.add(tiffCompSizer);
    this.tiffOptions.sizer = tiffSizer;

    // ── OK / Cancel ──────────────────────────────────────────────────────────
    this.okButton = new PushButton(this);
    this.okButton.defaultButton = true;
    this.okButton.text          = "OK";
    this.okButton.icon          = this.scaledResource(":/icons/ok.png");
    this.okButton.onClick = function() { self.ok(); };

    this.cancelButton = new PushButton(this);
    this.cancelButton.text = "Cancel";
    this.cancelButton.icon = this.scaledResource(":/icons/cancel.png");
    this.cancelButton.onClick = function() { self.cancel(); };

    var buttonSizer = new HorizontalSizer;
    buttonSizer.spacing = 6;
    buttonSizer.addStretch();
    buttonSizer.add(this.okButton);
    buttonSizer.add(this.cancelButton);

    // ── Root layout ──────────────────────────────────────────────────────────
    this.sizer = new VerticalSizer;
    this.sizer.margin  = 8;
    this.sizer.spacing = 8;
    this.sizer.add(this.warningLabel);
    this.sizer.addSpacing(4);
    this.sizer.add(pathSizer);
    this.sizer.add(this.unsavedHint);
    this.sizer.add(formatSizer);
    this.sizer.add(this.jpegOptions);
    this.sizer.add(this.pngOptions);
    this.sizer.add(this.tiffOptions);
    this.sizer.addSpacing(4);
    this.sizer.add(buttonSizer);

    this.adjustToContents();
}
SaveImageDialog.prototype = new Dialog;

// ─── Main ─────────────────────────────────────────────────────────────────────

function SaveStretchedJPEG() {
    var window = ImageWindow.activeWindow;

    if (window.isNull) {
        console.writeln("No active image window to save.");
        return;
    }

    // Pre-fill the path with the JPEG sibling of the source file (if saved)
    var suggestedPath = "";
    var originalPath  = window.filePath;
    if (originalPath !== null && originalPath !== "") {
        suggestedPath = File.extractDrive(originalPath) +
                        File.extractDirectory(originalPath) + "/" +
                        File.extractName(originalPath) + ".jpeg";
    }

    var dialog = new SaveImageDialog(window, suggestedPath);
    if (!dialog.execute()) return;

    var targetPath  = dialog.pathEdit.text.trim();
    var formatIndex = dialog.formatCombo.currentItem;
    var format      = FORMATS[formatIndex];

    // Build format-specific hint string
    var hints = "";
    switch (formatIndex) {
        case 0: // JPEG
            hints = "quality " + Math.round(dialog.jpegQuality.value);
            if (dialog.jpegProgressive.checked) hints += " progressive";
            break;
        case 1: // PNG
            hints = "compression " + Math.round(dialog.pngCompression.value);
            if (dialog.pngInterlaced.checked) hints += " interlaced";
            break;
        case 2: // TIFF
            hints = ["no-compression", "lzw-compression", "zip-compression"]
                        [dialog.tiffCompression.currentItem];
            break;
    }

    // Path not yet set — ask before doing any heavy work
    if (targetPath === "") {
        var saveDialog = new SaveFileDialog;
        saveDialog.caption     = "Save Stretched Image";
        saveDialog.filters     = format.filters;
        saveDialog.initialPath = window.mainView.id + format.ext;
        if (!saveDialog.execute()) return;
        targetPath = saveDialog.fileName;
    }

    var view = window.mainView;
    var stf  = view.stf;

    // 1. Clone the image
    var isColor = (view.image.colorSpace === ColorSpace_RGB);

    var cloneWindow = new ImageWindow(
        view.image.width,
        view.image.height,
        view.image.numberOfChannels,
        window.bitsPerSample,
        window.isFloatSample,
        isColor,
        view.id + "_temp_export"
    );

    var cloneView = cloneWindow.mainView;
    cloneView.beginProcess();
    cloneView.image.assign(view.image);
    cloneView.endProcess();

    // 2. Map STF to a permanent HistogramTransformation
    var ht = new HistogramTransformation;
    ht.H = [
        [stf[0][1], stf[0][0], stf[0][2], 0.0, 1.0], // R or K
        [stf[1][1], stf[1][0], stf[1][2], 0.0, 1.0], // G
        [stf[2][1], stf[2][0], stf[2][2], 0.0, 1.0], // B
        [stf[3][1], stf[3][0], stf[3][2], 0.0, 1.0], // RGB/L
        [0.0, 0.5, 1.0, 0.0, 1.0]                    // Alpha
    ];
    ht.executeOn(cloneView);

    // 3. Write with format-specific hints
    var fmt = new FileFormat(format.name, false/*toRead*/, true/*toWrite*/);
    if (fmt.isNull) {
        console.criticalln(format.label + " format not available.");
        cloneWindow.forceClose();
        return;
    }

    var f = new FileFormatInstance(fmt);
    if (f.isNull) {
        console.criticalln("Could not create " + format.label + " format instance.");
        cloneWindow.forceClose();
        return;
    }

    if (!f.create(targetPath, hints)) {
        console.criticalln("Could not create output file: " + f.errorMessage);
        cloneWindow.forceClose();
        return;
    }

    var ok     = f.writeImage(cloneView.image);
    var errMsg = f.errorMessage;
    f.close();

    if (ok) {
        console.writeln("<b>Saved stretched " + format.label + " to:</b> " + targetPath);
        if (hints !== "") console.writeln("  hints: " + hints);
    } else {
        console.criticalln("Failed to write " + format.label + ": " + errMsg);
    }

    // 4. Nuke the temporary clone from the workspace
    cloneWindow.forceClose();
}

SaveStretchedJPEG();
