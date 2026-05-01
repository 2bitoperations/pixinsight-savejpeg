#include <pjsr/ColorSpace.jsh>

#feature-id    Utilities > SaveStretchedJPEG
#feature-info  Instantly saves the active image as a stretched .jpeg using the current STF.

function SaveStretchedJPEG() {
    var window = ImageWindow.activeWindow;

    if (window.isNull) {
        console.writeln("No active image window to save.");
        return;
    }

    var view = window.mainView;
    var stf = view.stf;

    // 1. Create a temporary clone of the image 
    // FIXED: Using standard PJSR header to evaluate boolean color space
    var isColor = (view.image.colorSpace === ColorSpace_RGB);

    var cloneWindow = new ImageWindow(
        view.image.width,               // int width
        view.image.height,              // int height
        view.image.numberOfChannels,    // int numberOfChannels
        window.bitsPerSample,           // int windowBitsPerSample
        window.isFloatSample,           // Boolean floatSample
        isColor,                        // Boolean color
        view.id + "_temp_jpeg"          // String id
    );
    
    var cloneView = cloneWindow.mainView;
    cloneView.beginProcess();
    cloneView.image.assign(view.image);
    cloneView.endProcess();

    // 2. Map the active window's STF parameters to a Histogram Transformation
    var ht = new HistogramTransformation;
    ht.H = [ 
        // Format: [shadows, midtones, highlights, out_shadows, out_highlights]
        [stf[0][1], stf[0][0], stf[0][2], 0.0, 1.0], // R or K
        [stf[1][1], stf[1][0], stf[1][2], 0.0, 1.0], // G
        [stf[2][1], stf[2][0], stf[2][2], 0.0, 1.0], // B
        [stf[3][1], stf[3][0], stf[3][2], 0.0, 1.0], // RGB/L
        [0.0, 0.5, 1.0, 0.0, 1.0]                    // Alpha
    ];

    // 3. Execute the stretch permanently on the clone
    ht.executeOn(cloneView);

    // 4. Determine the output path
    var originalPath = window.filePath;
    var targetPath = "";

    if (originalPath !== null && originalPath !== "") {
        // Drop the new file right next to the original
        var drive = File.extractDrive(originalPath);
        var dir = File.extractDirectory(originalPath);
        var name = File.extractName(originalPath);
        targetPath = drive + dir + "/" + name + ".jpeg";
    } else {
        // Fallback: If the image hasn't been saved yet, pop a quick save dialog
        var saveDialog = new SaveFileDialog;
        saveDialog.caption = "Save Stretched JPEG";
        saveDialog.filters = [["JPEG Files", "*.jpeg", "*.jpg"]];
        saveDialog.initialPath = view.id + ".jpeg";
        if (saveDialog.execute()) {
            targetPath = saveDialog.fileName;
        } else {
            cloneWindow.forceClose();
            return; // Abort if user cancels the dialog
        }
    }

    // 5. Save the file without prompting for JPEG quality (uses default high quality)
    if (targetPath !== "") {
        // saveAs parameters: filePath, queryOptions, allowMessages, strict, warningMessages
        cloneWindow.saveAs(targetPath, false, false, true, false); 
        console.writeln("<b>Saved stretched JPEG to:</b> " + targetPath);
    }

    // 6. Nuke the temporary clone from the workspace
    cloneWindow.forceClose();
}

SaveStretchedJPEG();


