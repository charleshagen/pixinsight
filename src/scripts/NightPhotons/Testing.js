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


function BatchCometIsolationEngine()
{
    this.inputFiles = new Array; // per instance file array


    this.readImage = function( filePath ) {
       var inputImageWindow = ImageWindow.open(filePath);
       return inputImageWindow[0]; // Return the first image window if there are multiple
    };
 
    this.writeImage = function( imageWindow, filePath )
    {
        // Compute the directory
        var fileDir = (this.outputDirectory.length > 0) ? this.outputDirectory : File.extractDrive( filePath ) + File.extractDirectory( filePath );
        if (!fileDir.endsWith( '/' )) {
            fileDir += '/';
        }
       
        var fileName = File.extractName( filePath );
        var outputFilePath = fileDir + this.outputPrefix + fileName + this.outputPostfix + this.outputExtension;
    
        console.writeln( "<end><cbr><br>Output file:" );
    
        if ( File.exists(outputFilePath) ){
            if (ToolParameters.overwriteExisting) {
                console.writeln( "<end><cbr>** Overwriting existing file: " + outputFilePath );
            } else {
                console.writeln( "<end><cbr>* File already exists: " + outputFilePath );
                for ( var u = 1; ; ++u ) {
                    var tryFilePath = File.appendToName( outputFilePath, '_' + u.toString() );
                    if ( !File.exists( tryFilePath ) ) {
                        outputFilePath = tryFilePath;
                        break;
                    }
                }
                console.writeln( "<end><cbr>* Writing to: <raw>" + outputFilePath + "</raw>" );
            }
       }
       else
       {
          console.writeln( "<raw>" + outputFilePath + "</raw>" );
       }
 
       // write the output image to disk using
       // Boolean ImageWindow.saveAs(
       //    String filePath[,
       //    Boolean queryOptions[,
       //    Boolean allowMessages[,
       //    Boolean strict[,
       //    Boolean verifyOverwrite]]]] )
       imageWindow.saveAs( outputFilePath, false, false, false, false );
       // this statement will force ImageWindow to disable all format and security features, as follows
       //    disable query format-specific options
       //    disable warning messages on missing format features (icc profiles, etc)
       //    disable strict image writing mode (ignore lossy image generation)
       //    disable overwrite verification/protection
 
    };
 
    this.loadReference = function() {
       try
       {
          this.referenceImageWindow = this.readImage(this.referenceImage);
          this.referenceView = this.referenceImageWindow.mainView;
       }
       catch ( error )
       {
          console.writeln( error.message );
          console.writeln( error.stack.replace(/^[^\(]+?[\n$]/gm, '')
             .replace(/^\s+at\s+/gm, '')
             .replace(/^Object.<anonymous>\s*\(/gm, '{anonymous}()@')
             .split('\n'));
 
          (new MessageBox( error.message + " Continue?", TITLE, StdIcon_Error, StdButton_Yes, StdButton_No )).execute();
       }
    };

    this.freeReference = function() {
       try
       {
          this.referenceView = null;
          if ( this.referenceImageWindow != null )
          {
             this.referenceImageWindow.purge();
             this.referenceImageWindow.close();
          }
          this.referenceImageWindow  = null;
       }
       catch ( error )
       {
          (new MessageBox( error.message, TITLE, StdIcon_Error, StdButton_Yes, StdButton_No )).execute();
       }
    };

}

function CometSubtract() {
    let referneceImage = ToolParameters.bbStarView.image;
    // Detect the stars in the reference image
    let stars = DetectStars(ToolParameters.referenceImage);
    // Threshold the stars detected
    // Detect PSFs in the reference image
    // Store the list of stars
    // Store the list of PSFs

    // For each file
        // Open the file object
        // Detect the PSFs
        // Correlate and find ratios
        // Subtract comet image by reference times median of ratio
        // Give it the astrometric solution of the reference image
        // Save the new image
}

function ContinuumSubtract() {
    // Detect the stars in the broadband image
    // Need to use the brighter of the images so we can reject the clipped
    // stars / stars above the flux threshold


    // Error condition checking
    let generateStarless = ToolParameters.starlessEnabled;
    with (ToolParameters) {
        if (nbStarView == undefined || bbStarView == undefined) {
            console.criticalln("Error: One or both of the Star-containing images are undefined. Please select a view!");
            return;
        }
        if (!ToolParameters.nbStarView.image.isGrayscale) {
            console.criticalln("Invalid colorspace for image: " + ToolParameters.nbStarView.id + ". Must be grayscale.");
            return;
        }
        if (!ToolParameters.bbStarView.image.isGrayscale) {
            console.criticalln("Invalid colorspace for image: " + ToolParameters.bbStarView.id + ". Must be grayscale.");
            return;
        }
        // See if starless is enabled
        if (starlessEnabled) {
            // If enabled and one or both of the starless images are undefined, warn but continue
            if (nbStarlessView == undefined || bbStarlessView == undefined) {
                generateStarless = false;
            }
            if (generateStarless) {
                if (!ToolParameters.nbStarlessView.image.isGrayscale) {
                    console.criticalln("Invalid colorspace for image: " + ToolParameters.nbStarlessView.id + ". Must be grayscale.");
                    generateStarless = false;
                }
                if (!ToolParameters.bbStarlessView.image.isGrayscale) {
                    console.criticalln("Invalid colorspace for image: " + ToolParameters.bbStarlessView.id + ". Must be grayscale.");
                    generateStarless = false;
                }
            }

            if (!generateStarless) {
                console.warningln("Warning: One or both of the starless images are undefined. Cannot create starless image!");
            }
        }
    }

    let broadbandImage = ToolParameters.bbStarView.image;
    let narrowbandImage = ToolParameters.nbStarView.image;

    // Star detection
    let stars = DetectStars(broadbandImage);

    // PSF generation
    let broadbandPSF = GeneratePSFs(ToolParameters.bbStarView, stars);
    let narrowbandPSF = GeneratePSFs(ToolParameters.nbStarView, stars);

    // Correlation
    let starFluxes = [];
    let ratioList = [];
    for (let i = 0; i < stars.length; ++i) {
        starFluxes.push([]);
    }

    for (let i = 0; i < broadbandPSF.length; ++i) {
        starFluxes[broadbandPSF[i][0]][0] = broadbandPSF[i][16];
    }

    for (let i = 0; i < narrowbandPSF.length; ++i) {
        starFluxes[narrowbandPSF[i][0]][1] = narrowbandPSF[i][16];
    }

    for (let i = 0; i < stars.length; ++i) {
        if (starFluxes[i].length == 2) {
            ratioList.push(starFluxes[i][0] / starFluxes[i][1]);
        }
    }

    // Error checking
    if (ratioList.length == 0) {
        console.criticalln("Error: No valid star pairs detected, cannot generate subtracted image.");
        return;
    }

    if (ratioList.length < 50) {
        console.warningln("Warning: Only " + ratioList.length + " valid star pairs detected, results may be inaccurate.");
    }

    // Ratio Calculation
    let ratio = Median(ratioList);

    // Resulting Image Generation
    let starID = GenerateValidID(ToolParameters.nbStarView.id + "_sub")
    SubtractImage(ToolParameters.nbStarView, ToolParameters.bbStarView, ratio, starID);
    ApplyAstrometricSolution(starID);
    
    if (generateStarless) {
        let starlessID = GenerateValidID(ToolParameters.nbStarlessView.id + "_sub")
        SubtractImage(ToolParameters.nbStarlessView, ToolParameters.bbStarlessView, ratio, starlessID);
        ApplyAstrometricSolution(starlessID);
    }
}

function Median(arr) {
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

function DetectStars(sourceImage) {
    let detector = new StarDetector;
    let fluxLimit = ToolParameters.maxFlux;
    let maxBrightStars = ToolParameters.maxStars;

    // Console Detector Progress
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

    let S = detector.stars(sourceImage);
    console.writeln("");

    let stars = []
    let radius = 2;

    // Set up the stars array for DynamicPSF: Take the n brightest stars that are lower than the max
    let numStars = Math.min(S.length, maxBrightStars);
    for (let i = 0; i < numStars; ++i) {
        numStars = Math.min(S.length, maxBrightStars);
        if (S[i].flux > fluxLimit) {
            ++maxBrightStars;
            continue;
        }
        stars.push([
            0, 0, DynamicPSF.prototype.Star_DetectedOk, S[i].pos.x - radius,
            S[i].pos.y - radius,
            S[i].pos.x + radius, S[i].pos.y + radius,
            S[i].pos.x, S[i].pos.y
        ]);
    }
    return stars;
}

function GeneratePSFs(sourceImage, starsList) {
    let P = new DynamicPSF;
    with (P) {
        views = [[sourceImage.id]];
        astrometry = false;
        autoAperture = true;
        searchRadius = 2;
        circularPSF = false;
        autoPSF = false;
        gaussianPSF = true;
        moffatPSF = false;
        moffat10PSF = false;
        moffat8PSF = false;
        moffat6PSF = false;
        moffat4PSF = false;
        moffat25PSF = false;
        moffat15PSF = false;
        lorentzianPSF = false;
        variableShapePSF = false;
        stars = starsList;
        executeGlobal();
    }

    return P.psf;
}

function GenerateValidID(id) {
    // Generate a new valid ID
    let iteration = 1;
    let newID = id + iteration;
    if (View.viewById(id).isNull){
        return id;
    }
    while(!View.viewById(newID).isNull) {
        iteration += 1;
        newID = id + iteration;
    }
    return newID;
}

function ApplyAstrometricSolution(id) {
    // Prefer narrowband astrometric solution if available, default to broadband otherwise
    if (ToolParameters.nbStarView.window.hasAstrometricSolution) {
        View.viewById(id).window.copyAstrometricSolution(ToolParameters.nbStarView.window);
        console.noteln(id + ": Astrometric solution applied from ", ToolParameters.nbStarView.id);
    } else if (ToolParameters.bbStarView.window.hasAstrometricSolution) {
        View.viewById(id).window.copyAstrometricSolution(ToolParameters.bbStarView.window);
        console.noteln(id + ": Astrometric solution applied from ", ToolParameters.bbStarView.id);
    }
}

function SubtractImage(img1, img2, scaleFactor, id) {
    let P = new PixelMath;
    P.expression = img1.id + "-("+img2.id+"-med("+img2.id+"))/"+scaleFactor;
    with (P) {
        useSingleExpression = true;
        generateOutput = true;
        optimization = true;
        createNewImage = true;
        showNewImage = true;
        newImageId = id;
        newImageColorSpace = PixelMath.prototype.Gray;
        executeOn(img1);
    }
}


function MainDialog() {
    this.__base__ = Dialog;
    this.__base__();
    var self = this;

    // TODO: Figure this out...
    this.textEditWidth = 25 * this.font.width( "M" );
    
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

        this.files_TreeBox = new TreeBox( this );
        this.files_TreeBox.multipleSelection = true;
        this.files_TreeBox.rootDecoration = false;
        this.files_TreeBox.alternateRowColor = true;
        this.files_TreeBox.setScaledMinSize( 300, 200 );
        this.files_TreeBox.numberOfColumns = 1;
        this.files_TreeBox.headerVisible = false;

        // for ( var i = 0; i < engine.inputFiles.length; ++i )
        // {
        //     var node = new TreeBoxNode( this.files_TreeBox );
        //     node.setText( 0, engine.inputFiles[i] );
        // }

        this.filesAdd_Button = new PushButton( this );
        this.filesAdd_Button.text = "Add";
        this.filesAdd_Button.icon = this.scaledResource( ":/icons/add.png" );
        this.filesAdd_Button.toolTip = "<p>Add image files to the input images list.</p>";
        // this.filesAdd_Button.onClick = function()
        // {
        //     var ofd = new OpenFileDialog;
        //     ofd.multipleSelections = true;
        //     ofd.caption = "Select Images";
        //     ofd.loadImageFilters();

        //     if ( ofd.execute() )
        //     {
        //         this.dialog.files_TreeBox.canUpdate = false;
        //         for ( var i = 0; i < ofd.fileNames.length; ++i )
        //         {
        //             var node = new TreeBoxNode( this.dialog.files_TreeBox );
        //             node.setText( 0, ofd.fileNames[i] );
        //             engine.inputFiles.push( ofd.fileNames[i] );
        //         }
        //         this.dialog.files_TreeBox.canUpdate = true;
        //     }
        // };

        this.filesClear_Button = new PushButton( this );
        this.filesClear_Button.text = "Clear";
        this.filesClear_Button.icon = this.scaledResource( ":/icons/clear.png" );
        this.filesClear_Button.toolTip = "<p>Clear the list of input images.</p>";
        // this.filesClear_Button.onClick = function()
        // {
        //     this.dialog.files_TreeBox.clear();
        //     engine.inputFiles.length = 0;
        // };

        this.filesInvert_Button = new PushButton( this );
        this.filesInvert_Button.text = "Invert Selection";
        this.filesInvert_Button.icon = this.scaledResource( ":/icons/select-invert.png" );
        this.filesInvert_Button.toolTip = "<p>Invert the current selection of input images.</p>";
        // this.filesInvert_Button.onClick = function()
        // {
        //     for ( var i = 0; i < this.dialog.files_TreeBox.numberOfChildren; ++i )
        //         this.dialog.files_TreeBox.child( i ).selected =
        //             !this.dialog.files_TreeBox.child( i ).selected;
        // };

        this.filesRemove_Button = new PushButton( this );
        this.filesRemove_Button.text = "Remove Selected";
        this.filesRemove_Button.icon = this.scaledResource( ":/icons/delete.png" );
        this.filesRemove_Button.toolTip = "<p>Remove all selected images from the input images list.</p>";
        // this.filesRemove_Button.onClick = function()
        // {
        //     engine.inputFiles.length = 0;
        //     for ( var i = 0; i < this.dialog.files_TreeBox.numberOfChildren; ++i )
        //         if ( !this.dialog.files_TreeBox.child( i ).selected )
        //             engine.inputFiles.push( this.dialog.files_TreeBox.child( i ).text( 0 ) );
        //     for ( var i = this.dialog.files_TreeBox.numberOfChildren; --i >= 0; )
        //         if ( this.dialog.files_TreeBox.child( i ).selected )
        //             this.dialog.files_TreeBox.remove( i );
        // };

        this.imagesButtonsSizer = new HorizontalSizer( this );
        with( this.imagesButtonsSizer ) {
            spacing = 4;
            add( this.filesAdd_Button );
            addStretch();
            add( this.filesClear_Button );
            add( this.filesInvert_Button );
            add( this.filesRemove_Button );
        }

        this.files_GroupBox = new GroupBox( this );
        with (this.files_GroupBox) {
            title = "Comet Images";
            sizer = new VerticalSizer;
            sizer.margin = 6;
            sizer.spacing = 4;
            sizer.add( this.files_TreeBox, this.textEditWidth );
            sizer.add( this.imagesButtonsSizer );
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
        ContinuumSubtract();
    }
}

main();
