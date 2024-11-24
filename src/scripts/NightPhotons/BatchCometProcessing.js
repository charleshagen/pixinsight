#feature-id    BatchCometIsolation : NightPhotons > BatchCometIsolation // TODO: Come up with an appropriate title
#feature-icon  @script_icons_dir/BatchCometIsolation.svg // TODO: Create an icon and populate it in the directory
#feature-info  Batch comet isolation script for comet processing // TODO: Make this better

#include <pjsr/StarDetector.jsh>
#include <pjsr/StdButton.jsh>
#include <pjsr/StdIcon.jsh>
#include <pjsr/Sizer.jsh>
#include <pjsr/NumericControl.jsh>

#define TITLE "BatchCometIsolation"
#define VERSION "1.0.0"

var ToolParameters = {
    referenceView: undefined,
    overwriteExisting: false,

    maxStars: 200,
    maxFlux: 2.0,
};

function BatchCometIsolationEngine() {
    
    // TODO: REMOVE! HARD CODED FOR TESTING!!!
    this.referenceFilepath = "C:/Users/Charlie/Desktop/Trash Subs/ScriptTesting/Input/TestRef.xisf";
    this.outputDirectory = "C:/Users/Charlie/Desktop/Trash Subs/ScriptTesting/Output";
    this.outputPostfix = "_iso";
    this.outputExtension = ".xisf";
    
    this.referenceWindow = null;
    this.referenceImage = null;
    this.referenceView = null;
    this.stars = new Array();
    this.referencePSFs = new Array();

    this.inputFiles = new Array();
    this.starFluxes = new Array();

    this.execute = function () {
        try {
            // Load the reference image
            this.referenceWindow = this.readImage(this.referenceFilepath);
            this.referenceView = this.referenceWindow.mainView;
            this.referenceImage = this.referenceView.image;

            this.referenceWindow.show();

            // Initialize the flux routine
            this.initializeFluxRoutine();

            console.noteln(this.referencePSFs.length);
            
            // Iterate over the files, process and save
            for( file of this.inputFiles) {
                let imageWindow = this.readImage(file);
                let imagePSFs = this.detectPSFs(imageWindow.mainView);
                console.noteln(imagePSFs.length);

                let scalar = this.generateScalar(imagePSFs);
                console.noteln(scalar);
                this.subtractImage(imageWindow.mainView, scalar);
                this.writeImage(imageWindow, file);
                imageWindow.purge();
                imageWindow.close();
            }
        } catch (error) {
            console.criticalln("");
            console.criticalln(error.message);
        }

        // Cleanup the reference window when done
        try {
            if (this.referenceWindow != null) {
                this.referenceWindow.purge();
                this.referenceWindow.close();
            }
            this.referenceWindow = null;
        } catch (error) {
            console.criticalln("Error closing reference file: " + error.message);
        }
    };

    this.subtractImage = function(view, scalar) {
        let P = new PixelMath;

        console.writeln(view.id + "-("+this.referenceView.id+"-med("+this.referenceView.id+"))/"+scalar);

        P.expression = view.id + "-("+this.referenceView.id+"-med("+this.referenceView.id+"))/"+scalar;
        P.useSingleExpression = true;
        P.generateOutput = true;
        P.optimization = true;
        P.createNewImage = false;
        P.newImageColorSpace = PixelMath.prototype.Gray;
        P.executeOn(view);
    }

    this.initializeFluxRoutine = function() {
        this.detectReferenceStars();
        this.referencePSFs = this.detectPSFs(this.referenceView);
        for (let i = 0; i < this.stars.length; ++i) {
            this.starFluxes.push([]);
        }
        for (let i = 0; i < this.referencePSFs.length; ++i) {
            this.starFluxes[this.referencePSFs[i][0]][0] = this.referencePSFs[i][16];
        }
    };

    this.generateScalar = function(psfList) {
        let ratioList = [];
        for (let i = 0; i < psfList.length; ++i) {
            this.starFluxes[psfList[i][0]][1] = psfList[i][16];
        }

        for (let i = 0; i < this.stars.length; ++i) {
            if (this.starFluxes[i].length == 2) {
                ratioList.push(this.starFluxes[i][0] / this.starFluxes[i][1]);
            }
        }
        return this.median(ratioList)
    }

    this.detectReferenceStars = function ( ) {
        let detector = new StarDetector;
        let fluxLimit = ToolParameters.maxFlux;
        let maxBrightStars = ToolParameters.maxStars;

        let lastProgressPc = 0;
        detector.progressCallback =
            (count, total) => {
                if (count == 0) {
                    console.write("<end><cbr>Detecting stars:   0%");
                    lastProgressPc = 0;
                    processEvents();
                }
                else {
                    let pc = Math.round(100 * count / total);
                    if (pc > lastProgressPc) {
                        console.write(format("<end>\b\b\b\b%3d%%", pc));
                        lastProgressPc = pc;
                        processEvents();
                    }
                }
                return true;
            };
    
        let S = detector.stars(this.referenceImage);
    
        this.stars = new Array();
        let radius = 2;
    
        let numStars = Math.min(S.length, maxBrightStars);
        for (let i = 0; i < numStars; ++i) {
            numStars = Math.min(S.length, maxBrightStars);
            if (S[i].flux > fluxLimit) {
                ++maxBrightStars;
                continue;
            }
            this.stars.push([
                0, 0, DynamicPSF.prototype.Star_DetectedOk, S[i].pos.x - radius,
                S[i].pos.y - radius,
                S[i].pos.x + radius, S[i].pos.y + radius,
                S[i].pos.x, S[i].pos.y
            ]);
        }
    };

    this.detectPSFs = function (sourceView) {
        let P = new DynamicPSF;
        P.views = [[sourceView.id]];
        P.astrometry = false;
        P.autoAperture = true;
        P.searchRadius = 2;
        P.circularPSF = false;
        P.autoPSF = false;
        P.gaussianPSF = true;
        P.moffatPSF = false;
        P.moffat10PSF = false;
        P.moffat8PSF = false;
        P.moffat6PSF = false;
        P.moffat4PSF = false;
        P.moffat25PSF = false;
        P.moffat15PSF = false;
        P.lorentzianPSF = false;
        P.variableShapePSF = false;
        P.stars = this.stars;
        P.executeGlobal();
    
        return P.psf;
    }

    this.readImage = function (filePath) {
        var inputImageWindow = ImageWindow.open(filePath);
        if (inputImageWindow == null) {
            console.warningln("The file at " + filePath + " could not be opened, skipping file.");
            return null;
        }
        return inputImageWindow[0]; // Return the first image window if there are multiple
    };

    this.writeImage = function (imageWindow, filePath) {
        // Compute the directory
        var fileDir = (this.outputDirectory.length > 0) ? this.outputDirectory : File.extractDrive(filePath) + File.extractDirectory(filePath);
        if (!fileDir.endsWith('/')) {
            fileDir += '/';
        }

        var fileName = File.extractName(filePath);
        var outputFilePath = fileDir + fileName + this.outputPostfix + this.outputExtension;

        console.writeln("<end><cbr><br>Output file:");

        if (File.exists(outputFilePath)) {
            if (ToolParameters.overwriteExisting) {
                console.writeln("<end><cbr>** Overwriting existing file: " + outputFilePath);
            } else {
                console.writeln("<end><cbr>* File already exists: " + outputFilePath);
                for (var u = 1; ; ++u) {
                    var tryFilePath = File.appendToName(outputFilePath, '_' + u.toString());
                    if (!File.exists(tryFilePath)) {
                        outputFilePath = tryFilePath;
                        break;
                    }
                }
                console.writeln("<end><cbr>* Writing to: <raw>" + outputFilePath + "</raw>");
            }
        }
        else {
            console.writeln("<raw>" + outputFilePath + "</raw>");
        }
        imageWindow.saveAs(outputFilePath, false, false, false, false);

    };

    this.median = function(arr) {
        if (arr.length === 0) {
            return null; // Handle empty array case
        }
    
        arr.sort((a, b) => a - b); // Sort the array in ascending order
        const middleIndex = Math.floor(arr.length / 2);
    
        if (arr.length % 2 === 0) {
            // Even number of elements, calculate average of middle two
            return (arr[middleIndex - 1] + arr[middleIndex]) / 2;
        } else {
            // Odd number of elements, return the middle element
            return arr[middleIndex];
        }
    }
}

var engine = new BatchCometIsolationEngine;

function MainDialog() {
    this.__base__ = Dialog;
    this.__base__();
    var self = this;

    // TODO: Figure this out...
    this.textEditWidth = 25 * this.font.width("M");

    // Window parameters
    this.windowTitle = TITLE;
    var panelWidth = this.font.width("<b>" + TITLE + " v" + VERSION + "</b> | Charles Hagen");
    var labelWidth1 = this.font.width("Narrowband:");
    var labelWidth2 = this.font.width("Maximum Stars: ");

    this.minWidth = panelWidth;
    this.width = 400;

    // --------------------------------------------------------------
    // Description & Title
    // --------------------------------------------------------------
    this.label = new Label(this);
    with (this.label) {
        wordWrapping = true;
        useRichText = true;
        margin = 4;
        // text = "<p><b>PhotometricContinuumSubtraction v" + VERSION + "</b> | Charles Hagen</p><br></br>"
        //     + "<p>Provide narrowband and broadband / continuum images as well as the starless images "
        //     + "(optional) for subtraction. The script will generate an image for both the star-"
        //     + "containing image, as well as the starless image if enabled.</p><br></br>"
        //     + "<i>Create a process icon with the view IDs and apply as a process icon to run without opening the dialog.</i>";
        text = "<p><b>" + TITLE + " v" + VERSION + "</b> | Charles Hagen</p>"
            + "<p>Provide grayscale narrowband and broadband star-containing linear images to compute the continuum subtraction weights and produce a continuum subtracted image. "
            + "Optionally, you may also provide linear starless images to be subtracted using the weights computed from the star-containing images. For images with "
            + "severe aberrations, it may be beneficial to run BlurX in correct only mode before using PCS.</p>"
            + "<p><i>Create a process icon with the view IDs and apply as a process icon to run without opening the dialog.</i></p>";
    }


    // --------------------------------------------------------------
    // Comet Images
    // --------------------------------------------------------------

    this.files_TreeBox = new TreeBox(this);
    this.files_TreeBox.multipleSelection = true;
    this.files_TreeBox.rootDecoration = false;
    this.files_TreeBox.alternateRowColor = true;
    this.files_TreeBox.setScaledMinSize(300, 200);
    this.files_TreeBox.numberOfColumns = 1;
    this.files_TreeBox.headerVisible = false;

    for ( var i = 0; i < engine.inputFiles.length; ++i )
    {
        var node = new TreeBoxNode( this.files_TreeBox );
        node.setText( 0, engine.inputFiles[i] );
    }

    this.filesAdd_Button = new PushButton(this);
    this.filesAdd_Button.text = "Add";
    this.filesAdd_Button.icon = this.scaledResource(":/icons/add.png");
    this.filesAdd_Button.toolTip = "<p>Add image files to the input images list.</p>";
    this.filesAdd_Button.onClick = function()
    {
        var ofd = new OpenFileDialog;
        ofd.multipleSelections = true;
        ofd.caption = "Select Images";
        ofd.loadImageFilters();

        if ( ofd.execute() )
        {
            this.dialog.files_TreeBox.canUpdate = false;
            for ( var i = 0; i < ofd.fileNames.length; ++i )
            {
                var node = new TreeBoxNode( this.dialog.files_TreeBox );
                node.setText( 0, ofd.fileNames[i] );
                engine.inputFiles.push( ofd.fileNames[i] );
            }
            this.dialog.files_TreeBox.canUpdate = true;
        }
    };

    this.filesClear_Button = new PushButton(this);
    this.filesClear_Button.text = "Clear";
    this.filesClear_Button.icon = this.scaledResource(":/icons/clear.png");
    this.filesClear_Button.toolTip = "<p>Clear the list of input images.</p>";
    this.filesClear_Button.onClick = function()
    {
        this.dialog.files_TreeBox.clear();
        engine.inputFiles.length = 0;
    };

    this.filesInvert_Button = new PushButton(this);
    this.filesInvert_Button.text = "Invert Selection";
    this.filesInvert_Button.icon = this.scaledResource(":/icons/select-invert.png");
    this.filesInvert_Button.toolTip = "<p>Invert the current selection of input images.</p>";
    this.filesInvert_Button.onClick = function()
    {
        for ( var i = 0; i < this.dialog.files_TreeBox.numberOfChildren; ++i )
            this.dialog.files_TreeBox.child( i ).selected =
                !this.dialog.files_TreeBox.child( i ).selected;
    };

    this.filesRemove_Button = new PushButton(this);
    this.filesRemove_Button.text = "Remove Selected";
    this.filesRemove_Button.icon = this.scaledResource(":/icons/delete.png");
    this.filesRemove_Button.toolTip = "<p>Remove all selected images from the input images list.</p>";
    this.filesRemove_Button.onClick = function()
    {
        engine.inputFiles.length = 0;
        for ( var i = 0; i < this.dialog.files_TreeBox.numberOfChildren; ++i )
            if ( !this.dialog.files_TreeBox.child( i ).selected )
                engine.inputFiles.push( this.dialog.files_TreeBox.child( i ).text( 0 ) );
        for ( var i = this.dialog.files_TreeBox.numberOfChildren; --i >= 0; )
            if ( this.dialog.files_TreeBox.child( i ).selected )
                this.dialog.files_TreeBox.remove( i );
    };

    this.imagesButtonsSizer = new HorizontalSizer(this);
    with (this.imagesButtonsSizer) {
        spacing = 4;
        add(this.filesAdd_Button);
        addStretch();
        add(this.filesClear_Button);
        add(this.filesInvert_Button);
        add(this.filesRemove_Button);
    }

    this.files_GroupBox = new GroupBox(this);
    with (this.files_GroupBox) {
        title = "Comet Images";
        sizer = new VerticalSizer;
        sizer.margin = 6;
        sizer.spacing = 4;
        sizer.add(this.files_TreeBox, this.textEditWidth);
        sizer.add(this.imagesButtonsSizer);
    }

    // --------------------------------------------------------------
    // Bottom Button Row
    // --------------------------------------------------------------

    this.newInstanceButton = new ToolButton(this);
    with (this.newInstanceButton) {
        icon = this.scaledResource(":/process-interface/new-instance.png");
        setScaledFixedSize(20, 20);
        toolTip = "New Instance";
        onMousePress = function () {
            this.hasFocus = true;
            ToolParameters.save();

            this.pushed = false;
            this.dialog.newInstance();
        };
    }

    this.ok_Button = new PushButton(this);
    with (this.ok_Button) {
        text = "Execute";
        icon = this.scaledResource(":/icons/ok.png");
        onClick = function () {
            this.dialog.ok();
        };
    }

    this.cancel_Button = new PushButton(this);
    with (this.cancel_Button) {
        text = "Cancel";
        icon = this.scaledResource(":/icons/cancel.png");
        onClick = function () {
            this.dialog.cancel();
        };
    }

    this.buttons_Sizer = new HorizontalSizer;
    with (this.buttons_Sizer) {
        scaledSpacing = 6;
        add(this.newInstanceButton);
        addStretch();
        add(this.ok_Button);
        add(this.cancel_Button);
    }

    // --------------------------------------------------------------
    // Global Sizer
    // --------------------------------------------------------------
    this.sizer = new VerticalSizer(this);
    with (this.sizer) {
        margin = 6;
        spacing = 4;
        add(this.label);
        addSpacing(4);
        add(this.files_GroupBox);
        addStretch();
        add(this.buttons_Sizer);
    }
}
MainDialog.prototype = new Dialog;

function showDialog() {
    let dialog = new MainDialog;
    return dialog.execute();
}

function main() {
    let retVal = 0;
    if (Parameters.isViewTarget) {
        console.show();
        ToolParameters.load();
        retVal = 1; // Dialog is never shown
    } else if (Parameters.isGlobalTarget) {
        ToolParameters.load(); // Load the parameters in global context
        retVal = showDialog();
    } else {
        retVal = showDialog();
    }

    if (retVal == 1) {
        engine.execute();
    }
}

main();
