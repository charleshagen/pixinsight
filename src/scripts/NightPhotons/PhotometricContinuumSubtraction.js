#feature-id    PhotometricContinuumSubtraction : NightPhotons > PhotometricContinuumSubtraction
#feature-icon  @script_icons_dir/PhotometricContinuumSubtraction.svg
#feature-info  Fully automatic continuum subtraction using a photometric calibration routine. Processes both star-containing and starless images to produce continuum-free narrowband images.

#include <pjsr/StarDetector.jsh>
#include <pjsr/StdButton.jsh>
#include <pjsr/StdIcon.jsh>
#include <pjsr/Sizer.jsh>
#include <pjsr/NumericControl.jsh>
#include <pjsr/ProcessExitStatus.jsh>

#define TITLE "PhotometricContinuumSubtraction"
#define VERSION "1.2.0"

var ToolParameters = {
    nbStarView: undefined,
    bbStarView: undefined,
    nbStarlessView: undefined,
    bbStarlessView: undefined,
    starlessEnabled: false,
    starRemovalMethod: 1,
    maxStars: 400,
    maxPeak: 0.8,
    generatePlot: true,
    save: function () {
        if (ToolParameters.nbStarView != undefined && !ToolParameters.nbStarView.isNull) {
            Parameters.set("NarrowbandStarViewID", ToolParameters.nbStarView.id);
        } else {
            Parameters.remove("NarrowbandStarViewID");
        }
        if (ToolParameters.bbStarView != undefined && !ToolParameters.bbStarView.isNull) {
            Parameters.set("BroadbandStarViewID", ToolParameters.bbStarView.id);
        } else {
            Parameters.remove("BroadbandStarViewID");
        }
        if (ToolParameters.nbStarlessView != undefined && !ToolParameters.nbStarlessView.isNull) {
            Parameters.set("NarrowbandStarlessViewID", ToolParameters.nbStarlessView.id);
        } else {
            Parameters.remove("NarrowbandStarlessViewID");
        }

        if (ToolParameters.bbStarlessView != undefined && !ToolParameters.bbStarlessView.isNull) {
            Parameters.set("BroadbandStarlessViewID", ToolParameters.bbStarlessView.id);
        } else {
            Parameters.remove("BroadbandStarlessViewID");
        }
        Parameters.set("StarlessEnabled", ToolParameters.starlessEnabled);
        Parameters.set("StarRemovalMethod", ToolParameters.starRemovalMethod);
        Parameters.set("MaximumStars", ToolParameters.maxStars);
        Parameters.set("MaximumPeak", ToolParameters.maxPeak);
        Parameters.set("GeneratePlot", ToolParameters.generatePlot);
    },
    load: function () {
        if (Parameters.has("NarrowbandStarViewID")) {
            ToolParameters.nbStarView = View.viewById(Parameters.getString("NarrowbandStarViewID"));
            if (ToolParameters.nbStarView.isNull) {
                console.warningln("Could not find view: \"" + Parameters.getString("NarrowbandStarViewID") + "\"")
                ToolParameters.nbStarView = undefined;
            }
        }
        if (Parameters.has("BroadbandStarViewID")) {
            ToolParameters.bbStarView = View.viewById(Parameters.getString("BroadbandStarViewID"));
            if (ToolParameters.bbStarView.isNull) {
                console.warningln("Could not find view: \"" + Parameters.getString("BroadbandStarViewID") + "\"")
                ToolParameters.bbStarView = undefined;
            }
        }
        if (Parameters.has("NarrowbandStarlessViewID")) {
            ToolParameters.nbStarlessView = View.viewById(Parameters.getString("NarrowbandStarlessViewID"));
            if (ToolParameters.nbStarlessView.isNull) {
                console.warningln("Could not find view: \"" + Parameters.getString("NarrowbandStarlessViewID") + "\"")
                ToolParameters.nbStarlessView = undefined;
            }
        }
        if (Parameters.has("BroadbandStarlessViewID")) {
            ToolParameters.bbStarlessView = View.viewById(Parameters.getString("BroadbandStarlessViewID"));
            if (ToolParameters.bbStarlessView.isNull) {
                console.warningln("Could not find view: \"" + Parameters.getString("BroadbandStarlessViewID") + "\"")
                ToolParameters.bbStarlessView = undefined;
            }
        }
        if (Parameters.has("StarlessEnabled")) {
            ToolParameters.starlessEnabled = Parameters.getBoolean("StarlessEnabled");
        }
        if (Parameters.has("StarRemovalMethod")) {
            ToolParameters.starRemovalMethod = Parameters.getInteger("StarRemovalMethod");
        }
        if (Parameters.has("MaximumStars")) {
            ToolParameters.maxStars = Parameters.getInteger("MaximumStars");
        }
        if (Parameters.has("MaximumPeak")) {
            ToolParameters.maxPeak = Parameters.getReal("MaximumPeak");
        }
        if (Parameters.has("GeneratePlot")) {
            ToolParameters.generatePlot = Parameters.getBoolean("GeneratePlot");
        }
    }
};

function continuumSubtract() {
    // Error condition checking
    let generateStarless = ToolParameters.starlessEnabled;
    let closeStarlessBB = false;
    let closeStarlessNB = false;

    with (ToolParameters) {
        if (nbStarView == undefined || bbStarView == undefined) {
            console.criticalln("Error: One or both of the Star-containing images are undefined. Please select a view!");
            console.show();
            return;
        }
        if (!ToolParameters.nbStarView.image.isGrayscale) {
            console.criticalln("Invalid colorspace for image: " + ToolParameters.nbStarView.id + ". Must be grayscale.");
            console.show();
            return;
        }
        if (!ToolParameters.bbStarView.image.isGrayscale) {
            console.criticalln("Invalid colorspace for image: " + ToolParameters.bbStarView.id + ". Must be grayscale.");
            console.show();
            return;
        }
        // See if starless is enabled
        if (starlessEnabled) {
            // If enabled and one or both of the starless images are undefined, warn but continue
            if (generateStarless && nbStarlessView == undefined) {
                if (ToolParameters.starRemovalMethod != 0) {
                    ToolParameters.nbStarlessView = cloneView(ToolParameters.nbStarView, generateValidID(ToolParameters.nbStarView.id + "_starless")); 
                    if (!removeStars(ToolParameters.nbStarlessView)) {
                        generateStarless = false;
                    }
                    closeStarlessNB = true;
                } else {
                    generateStarless = false;
                }
            }
            if (generateStarless && bbStarlessView == undefined) {
                if (ToolParameters.starRemovalMethod != 0) {
                    ToolParameters.bbStarlessView = cloneView(ToolParameters.bbStarView, generateValidID(ToolParameters.bbStarView.id + "_starless")); 
                    if (!removeStars(ToolParameters.bbStarlessView)) {
                        generateStarless = false;
                    }
                    closeStarlessBB = true;
                } else {
                    generateStarless = false;
                }
            }
            if (generateStarless) {
                if (!ToolParameters.nbStarlessView.image.isGrayscale) {
                    console.warningln("Invalid colorspace for image: " + ToolParameters.nbStarlessView.id + ". Must be grayscale.");
                    console.show();
                    generateStarless = false;
                }
                if (!ToolParameters.bbStarlessView.image.isGrayscale) {
                    console.warningln("Invalid colorspace for image: " + ToolParameters.bbStarlessView.id + ". Must be grayscale.");
                    console.show();
                    generateStarless = false;
                }
            }

            if (!generateStarless) {
                console.warningln("Warning: One or both of the starless images are undefined. Cannot create starless image! Define starless images or enable StarXterminator as a fallback.");
            }
        }
    }

    let broadbandImage = ToolParameters.bbStarView.image;
    let narrowbandImage = ToolParameters.nbStarView.image;

    // Star detection
    let stars = detectStars(broadbandImage);
   if (stars.length == 0) {
        console.criticalln("Error: No stars detected. Try adjusting the maximum star peak parameter.");
        console.show();
        return;
    }

    // PSF generation
    let broadbandPSF = generatePSFs(ToolParameters.bbStarView, stars);
    let narrowbandPSF = generatePSFs(ToolParameters.nbStarView, stars);

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

    // Plot file output initialization 
    var tmpDir = File.systemTempDirectory;
    var dataFilepath = tmpDir + "/data.dat";
    var trendFilepath = tmpDir + "/trendline.dat";
    var gnuFilepath = tmpDir + "/fluxes.gnu";
    var svgFilepath = tmpDir + "/PCS_plot.svg";

    var xList = [];
    var yList = [];

    // Write and push ratio data
    var f = new File;
    f.createForWriting( dataFilepath );
    for (let i = 0; i < stars.length; ++i) {
      if (starFluxes[i].length == 2 && starFluxes[i][0] != null && starFluxes[i][1] != null) {
        const x = starFluxes[i][0];
        const y = starFluxes[i][1];
    
        xList.push(x);
        yList.push(y);

        ratioList.push(starFluxes[i][0] / starFluxes[i][1]);
        
        if (ToolParameters.generatePlot) {
            f.outTextLn(format("%.4f %.4f", x, y));
        }

        // Push to ratio list for calculation
        ratioList.push(x / y);
      }
    }
    f.close();


    // Error checking
    if (ratioList.length == 0) {
        console.criticalln("Error: No valid star pairs detected, cannot generate subtracted image.");
        console.show();
        return;
    }

    if (ratioList.length < 50) {
        console.warningln("Warning: Only " + ratioList.length + " valid star pairs detected, results may be inaccurate.");
        console.show();
    }

    // Ratio Calculation
    let ratio = median(ratioList);

    // Star-Containing Subtracted Image
    let starID = generateValidID(ToolParameters.nbStarView.id + "_sub")
    subtractImage(ToolParameters.nbStarView, ToolParameters.bbStarView, ratio, starID);
    applyAstrometricSolution(starID);

    // Starless Subtracted Image
    if (generateStarless) {
        let starlessID = generateValidID(ToolParameters.nbStarlessView.id + "_sub")
        subtractImage(ToolParameters.nbStarlessView, ToolParameters.bbStarlessView, ratio, starlessID);
        applyAstrometricSolution(starlessID);
    }

    // Clean up starless images if generated
    if (closeStarlessBB) { 
        console.writeln("Cleaning up broadband starless");
        ToolParameters.bbStarlessView.window.forceClose(); 
    }

    if (closeStarlessNB) { 
        console.writeln("Cleaning up narrowband starless");
        ToolParameters.nbStarlessView.window.forceClose(); 
    }

    // Generate the plot
    if (ToolParameters.generatePlot) {
        var xQuartiles = quartiles(xList);
        var yQuartiles = quartiles(yList);

        // Set plot limits
        var minX = xQuartiles[1] * 0.5 // Q1
        var maxX = xQuartiles[3] * 2.0 // Q3
        var minY = yQuartiles[1] * 0.5 // Q1
        var maxY = yQuartiles[3] * 2.0 // Q3

        // Write trendline data file
        var f = new File;
        f.createForWriting( trendFilepath );
        f.outTextLn("0 0");
        if (maxX/ratio < maxY) {
            f.outTextLn(format( "%.4f %.4f", 0.99*maxX, 0.99*maxX/ratio));
        } else {
            f.outTextLn(format( "%.4f %.4f", 0.99*maxY*ratio, 0.99*maxY));
        }
        f.close();

        // Write gnuplot file
        var f = new File;
        f.createForWriting( gnuFilepath );
        f.outTextLn( "set terminal svg size 600,600 enhanced font 'helvetica,12' background rgb 'white'" );
        f.outTextLn( "set title 'Broadband vs. Narrowband Flux' font 'helvetica,16'" );
        f.outTextLn( "set grid" );
        f.outTextLn( "set xlabel \"Broadband Flux\"" );
        f.outTextLn( "set ylabel \"Narrowband Flux\"" );
        f.outTextLn( "set xrange [" + minX.toFixed(3) + ":" + maxX.toFixed(3) + "]" );
        f.outTextLn( "set yrange [" + minY.toFixed(3) + ":" + maxY.toFixed(3) + "]" );
        f.outTextLn( "set output '" + svgFilepath + "'" );
        f.outTextLn( "plot '" + dataFilepath + "' with points lc rgbcolor '#E00000' title \"Fluxes\", \\" );
        f.outTextLn( "'" + trendFilepath + "' with lines lc rgbcolor '#0000E0' title \"Trendline\"" );

        f.close();

        // Run gnuplot to generate plot
        run( "\"" + getEnvironmentVariable( "PXI_BINDIR" ) + "/gnuplot\" \"" + gnuFilepath + "\"" );

        // Load the image
        ImageWindow.open( svgFilepath )[0].show();
    }
}

function detectStars(sourceImage) {
    let detector = new StarDetector;
    detector.upperLimit = ToolParameters.maxPeak;
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

    let numStars = Math.min(S.length, maxBrightStars);
    // Set up the stars array for DynamicPSF: Take the n brightest stars that are lower than the max
    console.writeln("Stars detected: " + S.length);
    for (let i = 0; i < numStars; ++i) {
        stars.push([
            0, 0, DynamicPSF.prototype.Star_DetectedOk, S[i].pos.x - radius,
            S[i].pos.y - radius,
            S[i].pos.x + radius, S[i].pos.y + radius,
            S[i].pos.x, S[i].pos.y
        ]);
    }
    return stars;
}

function generatePSFs(sourceImage, starsList) {
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

function generateValidID(id) {
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

function applyAstrometricSolution(id) {
    // Prefer narrowband astrometric solution if available, default to broadband otherwise
    if (ToolParameters.nbStarView.window.hasAstrometricSolution) {
        View.viewById(id).window.copyAstrometricSolution(ToolParameters.nbStarView.window);
        console.noteln(id + ": Astrometric solution applied from ", ToolParameters.nbStarView.id);
    } else if (ToolParameters.bbStarView.window.hasAstrometricSolution) {
        View.viewById(id).window.copyAstrometricSolution(ToolParameters.bbStarView.window);
        console.noteln(id + ": Astrometric solution applied from ", ToolParameters.bbStarView.id);
    }
}

function subtractImage(img1, img2, scaleFactor, id) {
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

function median(arr) {
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

function quartiles(arr) {
    if (arr.length === 0) {
        return null; // Handle empty array case
    }
    arr.sort((a, b) => a - b);
    const q1Index = Math.floor(arr.length / 4);
    const q2Index = Math.floor(arr.length / 2);
    const q3Index = Math.ceil(arr.length * 3 / 4);

    const min = arr[0];
    const Q1 = arr.length % 2 === 0 ? (arr[q1Index - 1] + arr[q1Index]) / 2 : arr[q1Index];
    const Q2 = arr.length % 2 === 0 ? (arr[q2Index - 1] + arr[q2Index]) / 2 : arr[q2Index];
    const Q3 = arr.length % 2 === 0 ? (arr[q3Index - 1] + arr[q3Index]) / 2 : arr[q3Index];
    const max = arr[arr.length - 1];

    return [min, Q1, Q2, Q3, max];
}

function removeStars(view) {
    switch (ToolParameters.starRemovalMethod) {
        case 1:
            try {
                let P = new StarXTerminator;
                P.stars = false;
                P.unscreen = false;
                P.overlap = 0.20;
            
                P.executeOn(view)
                return true;
            } catch (e) {
                console.criticalln("Could not remove stars from Image. Ensure that StarXTerminator is installed")
                console.criticalln(e)
                console.show();
                return false;
            }
        case 2:
            try {
                var P = new StarNet2;
                P.stride = StarNet2.prototype.defStride;
                P.mask = false;
                P.linear = true;
                P.upsample = false;
                P.shadows_clipping = -2.80;
                P.target_background = 0.25;
            
                P.executeOn(view)
                return true;
            } catch (e) {
                console.criticalln("Could not remove stars from Image. Ensure that StarXTerminator is installed")
                console.criticalln(e)
                console.show();
                return false;
            }
        default:
            return false;
    }

}

function cloneView(view, newId) {
    try {
        let newWindow = new ImageWindow(1, 1, 1, view.window.bitsPerSample, view.window.isFloatSample, view.image.isColor, newId);
        newWindow.mainView.beginProcess(UndoFlag_NoSwapFile);
        newWindow.mainView.image.assign(view.image);
        newWindow.mainView.endProcess();
        newWindow.mainView.stf = view.stf;
        return newWindow.mainView;
    } catch (e) {
        console.criticalln(e)
    };
    return null;
};

function run( program, maxRunningTimeSec )
{
   if ( maxRunningTimeSec === undefined )
      maxRunningTimeSec = 10;
   var P = new ExternalProcess( program );
   if ( P.waitForStarted() )
   {
      processEvents();
      var n = 0;
      var nmax = Math.round( maxRunningTimeSec*1000/250 );
      for ( ; n < nmax && !P.waitForFinished( 250 ); ++n )
      {
         console.write( "<end>\b" + "-/|\\".charAt( n%4 ) );
         processEvents();
      }
      if ( n > 0 )
         console.writeln( "<end>\b" );
   }
   if ( P.exitStatus == ProcessExitStatus_Crash || P.exitCode != 0 )
   {
      var e = P.stderr;
      throw new ParseError( "Process failed:\n" + program +
                            ((e.length > 0) ? "\n" + e : ""), tokens, index );
   }
}

function MainDialog() {
    this.__base__ = Dialog;
    this.__base__();
    var self = this;

    // Window parameters
    this.windowTitle = TITLE;
    var panelWidth = this.font.width("<b>PhotometricContinuumSubtraction v" + VERSION + "</b> | Charles Hagen");
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
        text = "<p><b>PhotometricContinuumSubtraction v" + VERSION + "</b> | Charles Hagen</p>"
            + "<p>Provide grayscale narrowband and broadband star-containing linear images to compute the continuum subtraction weights and produce a continuum subtracted image. "
            + "Optionally, you may also provide linear starless images to be subtracted using the weights computed from the star-containing images or enable a fallback star removal "
            + "method to allow PCS to generate the intermediate starless images automatically. For images with severe stellar aberrations, it may be beneficial to run BlurX "
            + "in correct only mode before using PCS.</p>"
            + "<p><i>Create a process icon with the view IDs and apply as a process icon to run without opening the dialog.</i></p>";
    }


    // --------------------------------------------------------------
    // Original Images
    // --------------------------------------------------------------

    // Narrowband View Selector
    this.nbStarLabel = new Label(this);
    with (this.nbStarLabel) {
        text = "Narrowband:";
        minWidth = labelWidth1;
        maxWidth = labelWidth1;
        textAlignment = TextAlign_Right | TextAlign_VertCenter;
    }

    this.nbStarViewList = new ViewList(this);
    with (this.nbStarViewList) {
        getMainViews();
        onViewSelected = function (view) {
            ToolParameters.nbStarView = view;
        }
        if (ToolParameters.nbStarView != undefined) {
            currentView = ToolParameters.nbStarView;
        }
    }

    this.nbStarSetActiveButton = new ToolButton(this);
    with (this.nbStarSetActiveButton) {
        icon = this.scaledResource(":/icons/select-view.png");
        setScaledFixedSize(20, 20);
        toolTip = "Set active window as target";
        onClick = function () {
            ToolParameters.nbStarView = ImageWindow.activeWindow.currentView;
            self.nbStarViewList.currentView = ToolParameters.nbStarView;
        }
    }

    this.nbStarSizer = new HorizontalSizer(this);
    with (this.nbStarSizer) {
        margin = 6;
        add(this.nbStarLabel, 1);
        addSpacing(5);
        add(this.nbStarViewList, 0);
        addSpacing(5);
        add(this.nbStarSetActiveButton, 1);
    }

    // Broadband View Selector
    this.bbStarLabel = new Label(this);
    with (this.bbStarLabel) {
        text = "Broadband:";
        minWidth = labelWidth1;
        maxWidth = labelWidth1;
        textAlignment = TextAlign_Right | TextAlign_VertCenter;
    }

    this.bbStarViewList = new ViewList(this);
    with (this.bbStarViewList) {
        getMainViews();
        onViewSelected = function (view) {
            ToolParameters.bbStarView = view;
        }
        if (ToolParameters.bbStarView != undefined) {
            currentView = ToolParameters.bbStarView;
        }
    }

    this.bbStarSetActiveButton = new ToolButton(this);
    with (this.bbStarSetActiveButton) {
        icon = this.scaledResource(":/icons/select-view.png");
        setScaledFixedSize(20, 20);
        toolTip = "Set active window as target";
        onClick = function () {
            ToolParameters.bbStarView = ImageWindow.activeWindow.currentView;
            self.bbStarViewList.currentView = ToolParameters.bbStarView;
        }
    }

    this.bbStarSizer = new HorizontalSizer(this);
    with (this.bbStarSizer) {
        margin = 6;
        add(this.bbStarLabel, 1);
        addSpacing(5);
        add(this.bbStarViewList, 0, Align_Expand);
        addSpacing(5);
        add(this.bbStarSetActiveButton, 1);
    }

    // Group Sizer
    this.starGroup = new GroupBox(this)
    with (this.starGroup) {
        title = "Original Views";
        sizer = new VerticalSizer;
    }
    with (this.starGroup.sizer) {
        add(this.nbStarSizer);
        add(this.bbStarSizer);
    }


    // --------------------------------------------------------------
    // Starless Images
    // --------------------------------------------------------------

    this.starXComboBox = new ComboBox(this);
    with (this.starXComboBox) {
        toolTip = "<p>If views are not provided, StarXTerminator (if present in your pixinsight installation) will be used to Generate starless images for the PCS routine.</p>";
        addItem("<None>");
        addItem("StarXTerminator");
        addItem("StarNet V2");
        currentItem = ToolParameters.starRemovalMethod;
        maxWidth = this.font.width("StarXTerminator") + 40;
        width = this.font.width("StarXTerminator") + 40;
        onItemSelected = function (indx) {
            ToolParameters.starRemovalMethod = indx;
        }
    }

    this.starXLabel = new Label(this);
    with (this.starXLabel) {
        text = "Fallback:";
        minWidth = labelWidth1;
        maxWidth = labelWidth1;
        textAlignment = TextAlign_Right | TextAlign_VertCenter;
    }

    this.starXSizer = new HorizontalSizer(this);
    with (this.starXSizer) {
        margin = 6;
        add(this.starXLabel);
        addSpacing(5);
        add(this.starXComboBox);
        addStretch()
    }

    // Narrowband View Selector
    this.nbStarlessLabel = new Label(this);
    with (this.nbStarlessLabel) {
        text = "Narrowband:";
        minWidth = labelWidth1;
        maxWidth = labelWidth1;
        textAlignment = TextAlign_Right | TextAlign_VertCenter;
    }

    this.nbStarlessViewList = new ViewList(this);
    with (this.nbStarlessViewList) {
        getMainViews();
        onViewSelected = function (view) {
            ToolParameters.nbStarlessView = view;
        }
        if (ToolParameters.nbStarlessView != undefined) {
            currentView = ToolParameters.nbStarlessView;
        }
    }

    this.nbStarlessSetActiveButton = new ToolButton(this);
    with (this.nbStarlessSetActiveButton) {
        icon = this.scaledResource(":/icons/select-view.png");
        setScaledFixedSize(20, 20);
        toolTip = "Set active window as target";
        onClick = function () {
            ToolParameters.nbStarlessView = ImageWindow.activeWindow.currentView;
            self.nbStarlessViewList.currentView = ToolParameters.nbStarlessView;
        }
    }

    this.nbStarlessSizer = new HorizontalSizer(this);
    with (this.nbStarlessSizer) {
        margin = 6;
        add(this.nbStarlessLabel);
        addSpacing(5);
        add(this.nbStarlessViewList);
        addSpacing(5);
        add(this.nbStarlessSetActiveButton);
    }

    // Broadband View Selector
    this.bbStarlessLabel = new Label(this);
    with (this.bbStarlessLabel) {
        text = "Broadband:";
        minWidth = labelWidth1;
        maxWidth = labelWidth1;
        textAlignment = TextAlign_Right | TextAlign_VertCenter;
    }

    this.bbStarlessViewList = new ViewList(this);
    with (this.bbStarlessViewList) {
        getMainViews();
        onViewSelected = function (view) {
            ToolParameters.bbStarlessView = view;
        }
        if (ToolParameters.bbStarlessView != undefined) {
            currentView = ToolParameters.bbStarlessView;
        }
    }

    this.bbStarlessSetActiveButton = new ToolButton(this);
    with (this.bbStarlessSetActiveButton) {
        icon = this.scaledResource(":/icons/select-view.png");
        setScaledFixedSize(20, 20);
        toolTip = "Set active window as target";
        onClick = function () {
            ToolParameters.bbStarlessView = ImageWindow.activeWindow.currentView;
            self.bbStarlessViewList.currentView = ToolParameters.bbStarlessView;
        }
    }

    this.bbStarlessSizer = new HorizontalSizer(this);
    with (this.bbStarlessSizer) {
        margin = 6;
        add(this.bbStarlessLabel);
        addSpacing(5);
        add(this.bbStarlessViewList);
        addSpacing(5);
        add(this.bbStarlessSetActiveButton);
    }

    // Group Sizer
    this.starlessGroup = new GroupBox(this)
    with (this.starlessGroup) {
        toolTip = "<p> Generate starless subtracted image.</p>"
        titleCheckBox = true;
        checked = ToolParameters.starlessEnabled;
        onCheck = function () {
            ToolParameters.starlessEnabled = checked;
        }
        title = "Generate Starless";
        sizer = new VerticalSizer;
    }
    with (this.starlessGroup.sizer) {
        add(this.nbStarlessSizer);
        add(this.bbStarlessSizer);
        add(this.starXSizer);
    }

    // --------------------------------------------------------------
    // Settings
    // --------------------------------------------------------------

    this.maxStarsLabel = new Label(this);
    with (this.maxStarsLabel) {
        text = "Maximum Stars: ";
        minWidth = labelWidth2;
        maxWidth = labelWidth2;
        textAlignment = TextAlign_Right | TextAlign_VertCenter;
    }

    this.maxStars = new NumericControl(this);
    with (this.maxStars) {
        toolTip = "<p> This field controls the maximum number of stars that will be included in the calculation, "+
        "higher values will include more stars which will take longer, but may provide more accurate results."+
        "<p>Default value is 400 stars</p>"
        setPrecision(2);
        setRange(50, 1000);
        setReal(true);
        slider.stepSize = 0.1;
        slider.setRange(0, 19);
        setValue(ToolParameters.maxStars);
        onValueUpdated = function (value) {
            ToolParameters.maxStars = value;
        }
    }

    this.maxStarsSizer = new HorizontalSizer(this);
    with (this.maxStarsSizer) {
        margin = 6;
        add(this.maxStarsLabel, 1);
        add(this.maxStars, 0);
    }

    this.maxPeakLabel = new Label(this);
    with (this.maxPeakLabel) {
        text = "Maximum Peak: ";
        minWidth = labelWidth2;
        maxWidth = labelWidth2;
        textAlignment = TextAlign_Right | TextAlign_VertCenter;
    }

    this.maxPeak = new NumericControl(this);
    with (this.maxPeak) {
        toolTip = "<p> This field controls the maximum peak value that a star can have to be included in the flux calculation, "+
        "higher values will be more tollerant of brighter stars and may begin to include saturated stars, which can degrade "+
        "the performance of the routine.</p>" +
        "<p>Default value is 0.8</p>"
        setPrecision(2);
        setRange(0, 1);
        setReal(true);
        slider.stepSize = 0.1;
        slider.setRange(0, 10);
        setValue(ToolParameters.maxPeak);
        onValueUpdated = function (value) {
            ToolParameters.maxPeak = value;
        }
    }

    this.maxPeakSizer = new HorizontalSizer(this);
    with (this.maxPeakSizer) {
        margin = 6;
        add(this.maxPeakLabel, 1);
        add(this.maxPeak, 0);
    }

    this.generatePlotLabel = new Label(this);
    with (this.generatePlotLabel) {
        toolTip = "<p>Plot narrowband flux vs. broadband flux. This can be useful for verifying the calculated fit and troubleshooting in the "+
        "event of poor subtraction. If the curve is non-linear, consider increasing the maximum number of stars.</p>";
        text = "Generate Plot: ";
        minWidth = labelWidth2;
        maxWidth = labelWidth2;
        textAlignment = TextAlign_Right | TextAlign_VertCenter;
    }

    this.generatePlotCheckBox = new CheckBox(this);
    with (this.generatePlotCheckBox) {
        toolTip = "<p>Plot narrowband flux vs. broadband flux. This can be useful for verifying the calculated fit and troubleshooting in the "+
        "event of poor subtraction. If the curve is non-linear, consider increasing the maximum number of stars.</p>";
        checked = ToolParameters.generatePlot
        // text = "Generate Plot";
        onCheck = function () {
            ToolParameters.generatePlot = checked;
        }
    }

    this.generatePlotSizer = new HorizontalSizer(this);
    with (this.generatePlotSizer) {
        margin = 6;
        add(this.generatePlotLabel, 1);
        addSpacing(10);
        add(this.generatePlotCheckBox, 0);
    }

    // Group Sizer
    this.settingsGroup = new GroupBox(this)
    with (this.settingsGroup) {
        title = "Settings";
        sizer = new VerticalSizer;
    }
    with (this.settingsGroup.sizer) {
        add(this.maxStarsSizer);
        add(this.maxPeakSizer);
        add(this.generatePlotSizer);
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
        add(this.starGroup);
        addSpacing(4);
        add(this.starlessGroup);
        addSpacing(4);
        add(this.settingsGroup);
        addSpacing(4);
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
        continuumSubtract();
    }
}

main();