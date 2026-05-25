#engine v8

#feature-id    PhotometricContinuumSubtraction : NightPhotons > PhotometricContinuumSubtraction
#feature-icon  @script_icons_dir/PhotometricContinuumSubtraction.svg
#feature-info  Fully automatic continuum subtraction using a photometric calibration routine. Processes both star-containing and starless images to produce continuum-free narrowband images.

CoreApplication.ensureMinimumVersion( 1, 9, 4 );

#define TITLE "PhotometricContinuumSubtraction"
#define VERSION "1.3.1"

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
        if (ToolParameters.nbStarView != undefined) {
            Parameters.set("NarrowbandStarViewID", ToolParameters.nbStarView.id);
        } else {
            Parameters.remove("NarrowbandStarViewID");
        }
        if (ToolParameters.bbStarView != undefined) {
            Parameters.set("BroadbandStarViewID", ToolParameters.bbStarView.id);
        } else {
            Parameters.remove("BroadbandStarViewID");
        }
        if (ToolParameters.nbStarlessView != undefined) {
            Parameters.set("NarrowbandStarlessViewID", ToolParameters.nbStarlessView.id);
        } else {
            Parameters.remove("NarrowbandStarlessViewID");
        }

        if (ToolParameters.bbStarlessView != undefined) {
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
            if (ToolParameters.nbStarView == null) {
                console.warningln("Could not find view: \"" + Parameters.getString("NarrowbandStarViewID") + "\"")
                ToolParameters.nbStarView = undefined;
            }
        }
        if (Parameters.has("BroadbandStarViewID")) {
            ToolParameters.bbStarView = View.viewById(Parameters.getString("BroadbandStarViewID"));
            if (ToolParameters.bbStarView == null) {
                console.warningln("Could not find view: \"" + Parameters.getString("BroadbandStarViewID") + "\"")
                ToolParameters.bbStarView = undefined;
            }
        }
        if (Parameters.has("NarrowbandStarlessViewID")) {
            ToolParameters.nbStarlessView = View.viewById(Parameters.getString("NarrowbandStarlessViewID"));
            if (ToolParameters.nbStarlessView == null) {
                console.warningln("Could not find view: \"" + Parameters.getString("NarrowbandStarlessViewID") + "\"")
                ToolParameters.nbStarlessView = undefined;
            }
        }
        if (Parameters.has("BroadbandStarlessViewID")) {
            ToolParameters.bbStarlessView = View.viewById(Parameters.getString("BroadbandStarlessViewID"));
            if (ToolParameters.bbStarlessView == null) {
                console.warningln("Could not find view: \"" + Parameters.getString("BroadbandStarlessViewID") + "\"")
                ToolParameters.bbStarlessView = undefined;
            }
        }
        if (Parameters.has("StarlessEnabled")) {
            ToolParameters.starlessEnabled = Parameters.getBoolean("StarlessEnabled");
        }
        if (Parameters.has("StarRemovalMethod")) {
            ToolParameters.starRemovalMethod = Parameters.getInteger("StarRemovalMethod");
            if (![0,1,2].includes(ToolParameters.starRemovalMethod)) {
                console.warningln("Detected invalid star removal method. Resetting to default value.")
                ToolParameters.starRemovalMethod = 1;
            }
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

    if (ToolParameters.nbStarView == null || ToolParameters.bbStarView == null) {
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
    if (generateStarless) {
        if (ToolParameters.nbStarlessView == null) {
            if ([1,2].includes(ToolParameters.starRemovalMethod)) {
                ToolParameters.nbStarlessView = cloneView(ToolParameters.nbStarView, generateValidID(ToolParameters.nbStarView.id + "_starless"));
                if (ToolParameters.nbStarlessView == null || !removeStars(ToolParameters.nbStarlessView)) generateStarless = false;
                closeStarlessNB = true;
            } else {
                generateStarless = false;
            }
        }
        if (generateStarless && ToolParameters.bbStarlessView == null) {
            if ([1,2].includes(ToolParameters.starRemovalMethod)) {
                ToolParameters.bbStarlessView = cloneView(ToolParameters.bbStarView, generateValidID(ToolParameters.bbStarView.id + "_starless"));
                if (ToolParameters.bbStarlessView == null || !removeStars(ToolParameters.bbStarlessView)) generateStarless = false;
                closeStarlessBB = true;
            } else {
                generateStarless = false;
            }
        }
        if (generateStarless && !ToolParameters.nbStarlessView.image.isGrayscale) {
            console.warningln("Invalid colorspace for image: " + ToolParameters.nbStarlessView.id + ". Must be grayscale.");
            console.show();
            generateStarless = false;
        }
        if (generateStarless && !ToolParameters.bbStarlessView.image.isGrayscale) {
            console.warningln("Invalid colorspace for image: " + ToolParameters.bbStarlessView.id + ". Must be grayscale.");
            console.show();
            generateStarless = false;
        }
        if (!generateStarless)
            console.warningln("Warning: One or both of the starless images are undefined. Cannot create starless image! Define starless images or enable StarXterminator as a fallback.");
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
    subtractImage(ToolParameters.nbStarView, ToolParameters.bbStarView, ToolParameters.bbStarView, ratio, starID);
    applyAstrometricSolution(starID);

    // Starless Subtracted Image
    if (generateStarless) {
        let starlessID = generateValidID(ToolParameters.nbStarlessView.id + "_sub")
        subtractImage(ToolParameters.nbStarlessView, ToolParameters.bbStarlessView, ToolParameters.bbStarView, ratio, starlessID);
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
        f = new File;
        f.createForWriting( trendFilepath );
        f.outTextLn("0 0");
        if (maxX/ratio < maxY) {
            f.outTextLn(format( "%.4f %.4f", 0.99*maxX, 0.99*maxX/ratio));
        } else {
            f.outTextLn(format( "%.4f %.4f", 0.99*maxY*ratio, 0.99*maxY));
        }
        f.close();

        // Write gnuplot file
        f = new File;
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
            0, 0, DynamicPSF.Star_DetectedOk, S[i].pos.x - radius,
            S[i].pos.y - radius,
            S[i].pos.x + radius, S[i].pos.y + radius,
            S[i].pos.x, S[i].pos.y
        ]);
    }
    return stars;
}

function generatePSFs(sourceImage, starsList) {
    let P = new DynamicPSF;
    P.views = [[sourceImage.id]];
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
    P.stars = starsList;
    P.executeGlobal();

    return P.psf;
}

function generateValidID(id) {
    // Generate a new valid ID
    let iteration = 1;
    let newID = id + iteration;
    if (View.viewById(id) == null){
        return id;
    }
    while (View.viewById(newID) != null) {
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

function subtractImage(img1, img2, med_img, scaleFactor, id) {
    let P = new PixelMath;
    P.expression = img1.id + "-("+img2.id+"-med("+med_img.id+"))/"+scaleFactor;
    P.useSingleExpression = true;
    P.generateOutput = true;
    P.optimization = true;
    P.createNewImage = true;
    P.showNewImage = true;
    P.newImageId = id;
    P.newImageColorSpace = PixelMath.Gray;
    P.executeOn(img1);
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
                P.ai_file = "StarXTerminator.11.pb";
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
                P.stride = StarNet2.defStride;
                P.mask = false;
                P.linear = true;
                P.upsample = false;
                P.shadows_clipping = -2.80;
                P.target_background = 0.25;

                P.executeOn(view)
                return true;
            } catch (e) {
                console.criticalln("Could not remove stars from Image. Ensure that StarNet2 is installed")
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
        newWindow.mainView.beginProcess(UndoFlag.NoSwapFile);
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
   if ( P.exitStatus == ProcessExitStatus.Crash || P.exitCode != 0 )
   {
      var e = P.stderr;
      throw new Error( "Process failed:\n" + program +
                       ((e.length > 0) ? "\n" + e : "") );
   }
}

var MainDialog = class extends Dialog {
constructor() {
    super();
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
    this.label.wordWrapping = true;
    this.label.useRichText = true;
    this.label.margin = 4;
    // this.label.text = "<p><b>PhotometricContinuumSubtraction v" + VERSION + "</b> | Charles Hagen</p><br></br>"
    //     + "<p>Provide narrowband and broadband / continuum images as well as the starless images "
    //     + "(optional) for subtraction. The script will generate an image for both the star-"
    //     + "containing image, as well as the starless image if enabled.</p><br></br>"
    //     + "<i>Create a process icon with the view IDs and apply as a process icon to run without opening the dialog.</i>";
    this.label.text = "<p><b>PhotometricContinuumSubtraction v" + VERSION + "</b> | Charles Hagen</p>"
        + "<p>Provide grayscale narrowband and broadband star-containing linear images to compute the continuum subtraction weights and produce a continuum subtracted image. "
        + "Optionally, you may also provide linear starless images to be subtracted using the weights computed from the star-containing images or enable a fallback star removal "
        + "method to allow PCS to generate the intermediate starless images automatically. For images with severe stellar aberrations, it may be beneficial to run BlurX "
        + "in correct only mode before using PCS.</p>"
        + "<p><i>Create a process icon with the view IDs and apply as a process icon to run without opening the dialog.</i></p>";


    // --------------------------------------------------------------
    // Original Images
    // --------------------------------------------------------------

    // Narrowband View Selector
    this.nbStarLabel = new Label(this);
    this.nbStarLabel.text = "Narrowband:";
    this.nbStarLabel.minWidth = labelWidth1;
    this.nbStarLabel.maxWidth = labelWidth1;
    this.nbStarLabel.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;

    this.nbStarViewList = new ViewList(this);
    this.nbStarViewList.getMainViews();
    this.nbStarViewList.onViewSelected = function (view) {
        if (view.isNull) {
            ToolParameters.nbStarView = undefined;
            return;    
        }
        ToolParameters.nbStarView = view;
    };
    if (ToolParameters.nbStarView != undefined && ToolParameters.nbStarView != null) {
        this.nbStarViewList.currentView = ToolParameters.nbStarView;
    }

    this.nbStarSetActiveButton = new ToolButton(this);
    this.nbStarSetActiveButton.icon = this.scaledResource(":/icons/select-view.png");
    this.nbStarSetActiveButton.setScaledFixedSize(20, 20);
    this.nbStarSetActiveButton.toolTip = "Set active window as target";
    this.nbStarSetActiveButton.onClick = function () {
        ToolParameters.nbStarView = ImageWindow.activeWindow.currentView;
        self.nbStarViewList.currentView = ToolParameters.nbStarView;
    };

    this.nbStarSizer = new HorizontalSizer(this);
    this.nbStarSizer.margin = 6;
    this.nbStarSizer.add(this.nbStarLabel, 1);
    this.nbStarSizer.addSpacing(5);
    this.nbStarSizer.add(this.nbStarViewList, 0);
    this.nbStarSizer.addSpacing(5);
    this.nbStarSizer.add(this.nbStarSetActiveButton, 1);

    // Broadband View Selector
    this.bbStarLabel = new Label(this);
    this.bbStarLabel.text = "Broadband:";
    this.bbStarLabel.minWidth = labelWidth1;
    this.bbStarLabel.maxWidth = labelWidth1;
    this.bbStarLabel.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;

    this.bbStarViewList = new ViewList(this);
    this.bbStarViewList.getMainViews();
    this.bbStarViewList.onViewSelected = function (view) {
        if (view.isNull) {
            ToolParameters.bbStarView = undefined;
            return;    
        }
        ToolParameters.bbStarView = view;
    };
    if (ToolParameters.bbStarView != undefined && ToolParameters.bbStarView != null) {
        this.bbStarViewList.currentView = ToolParameters.bbStarView;
    }

    this.bbStarSetActiveButton = new ToolButton(this);
    this.bbStarSetActiveButton.icon = this.scaledResource(":/icons/select-view.png");
    this.bbStarSetActiveButton.setScaledFixedSize(20, 20);
    this.bbStarSetActiveButton.toolTip = "Set active window as target";
    this.bbStarSetActiveButton.onClick = function () {
        ToolParameters.bbStarView = ImageWindow.activeWindow.currentView;
        self.bbStarViewList.currentView = ToolParameters.bbStarView;
    };

    this.bbStarSizer = new HorizontalSizer(this);
    this.bbStarSizer.margin = 6;
    this.bbStarSizer.add(this.bbStarLabel, 1);
    this.bbStarSizer.addSpacing(5);
    this.bbStarSizer.add(this.bbStarViewList, 0, Alignment.Expand);
    this.bbStarSizer.addSpacing(5);
    this.bbStarSizer.add(this.bbStarSetActiveButton, 1);

    this.starGroup = new GroupBox(this);
    this.starGroup.title = "Original Views";
    this.starGroup.sizer = new VerticalSizer;
    this.starGroup.sizer.add(this.nbStarSizer);
    this.starGroup.sizer.add(this.bbStarSizer);


    // --------------------------------------------------------------
    // Starless Images
    // --------------------------------------------------------------

    this.starXComboBox = new ComboBox(this);
    this.starXComboBox.toolTip = "<p>If views are not provided, StarXTerminator (if present in your pixinsight installation) will be used to Generate starless images for the PCS routine.</p>";
    this.starXComboBox.addItem("<None>");
    this.starXComboBox.addItem("StarXTerminator");
    this.starXComboBox.addItem("StarNet V2");
    this.starXComboBox.currentItem = ToolParameters.starRemovalMethod;
    this.starXComboBox.maxWidth = this.font.width("StarXTerminator") + 40;
    this.starXComboBox.width = this.font.width("StarXTerminator") + 40;
    this.starXComboBox.onItemSelected = function (indx) {
        ToolParameters.starRemovalMethod = indx;
    };

    this.starXLabel = new Label(this);
    this.starXLabel.text = "Fallback:";
    this.starXLabel.minWidth = labelWidth1;
    this.starXLabel.maxWidth = labelWidth1;
    this.starXLabel.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;

    this.starXSizer = new HorizontalSizer(this);
    this.starXSizer.margin = 6;
    this.starXSizer.add(this.starXLabel);
    this.starXSizer.addSpacing(5);
    this.starXSizer.add(this.starXComboBox);
    this.starXSizer.addStretch();

    // Narrowband View Selector
    this.nbStarlessLabel = new Label(this);
    this.nbStarlessLabel.text = "Narrowband:";
    this.nbStarlessLabel.minWidth = labelWidth1;
    this.nbStarlessLabel.maxWidth = labelWidth1;
    this.nbStarlessLabel.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;

    this.nbStarlessViewList = new ViewList(this);
    this.nbStarlessViewList.getMainViews();
    this.nbStarlessViewList.onViewSelected = function (view) {
        if (view.isNull) {
            ToolParameters.nbStarlessView = undefined;
            return;    
        }
        ToolParameters.nbStarlessView = view;
    };
    if (ToolParameters.nbStarlessView != undefined && ToolParameters.nbStarlessView != null) {
        this.nbStarlessViewList.currentView = ToolParameters.nbStarlessView;
    }

    this.nbStarlessSetActiveButton = new ToolButton(this);
    this.nbStarlessSetActiveButton.icon = this.scaledResource(":/icons/select-view.png");
    this.nbStarlessSetActiveButton.setScaledFixedSize(20, 20);
    this.nbStarlessSetActiveButton.toolTip = "Set active window as target";
    this.nbStarlessSetActiveButton.onClick = function () {
        ToolParameters.nbStarlessView = ImageWindow.activeWindow.currentView;
        self.nbStarlessViewList.currentView = ToolParameters.nbStarlessView;
    };

    this.nbStarlessSizer = new HorizontalSizer(this);
    this.nbStarlessSizer.margin = 6;
    this.nbStarlessSizer.add(this.nbStarlessLabel);
    this.nbStarlessSizer.addSpacing(5);
    this.nbStarlessSizer.add(this.nbStarlessViewList);
    this.nbStarlessSizer.addSpacing(5);
    this.nbStarlessSizer.add(this.nbStarlessSetActiveButton);

    // Broadband View Selector
    this.bbStarlessLabel = new Label(this);
    this.bbStarlessLabel.text = "Broadband:";
    this.bbStarlessLabel.minWidth = labelWidth1;
    this.bbStarlessLabel.maxWidth = labelWidth1;
    this.bbStarlessLabel.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;

    this.bbStarlessViewList = new ViewList(this);
    this.bbStarlessViewList.getMainViews();
    this.bbStarlessViewList.onViewSelected = function (view) {
        if (view.isNull) {
            ToolParameters.bbStarlessView = undefined;
            return;    
        }
        ToolParameters.bbStarlessView = view;
    };
    if (ToolParameters.bbStarlessView != undefined && ToolParameters.bbStarlessView != null) {
        this.bbStarlessViewList.currentView = ToolParameters.bbStarlessView;
    }

    this.bbStarlessSetActiveButton = new ToolButton(this);
    this.bbStarlessSetActiveButton.icon = this.scaledResource(":/icons/select-view.png");
    this.bbStarlessSetActiveButton.setScaledFixedSize(20, 20);
    this.bbStarlessSetActiveButton.toolTip = "Set active window as target";
    this.bbStarlessSetActiveButton.onClick = function () {
        ToolParameters.bbStarlessView = ImageWindow.activeWindow.currentView;
        self.bbStarlessViewList.currentView = ToolParameters.bbStarlessView;
    };

    this.bbStarlessSizer = new HorizontalSizer(this);
    this.bbStarlessSizer.margin = 6;
    this.bbStarlessSizer.add(this.bbStarlessLabel);
    this.bbStarlessSizer.addSpacing(5);
    this.bbStarlessSizer.add(this.bbStarlessViewList);
    this.bbStarlessSizer.addSpacing(5);
    this.bbStarlessSizer.add(this.bbStarlessSetActiveButton);

    // Group Sizer
    this.starlessGroup = new GroupBox(this);
    this.starlessGroup.toolTip = "<p> Generate starless subtracted image.</p>";
    this.starlessGroup.titleCheckBox = true;
    this.starlessGroup.checked = ToolParameters.starlessEnabled;
    this.starlessGroup.onCheck = function () {
        ToolParameters.starlessEnabled = this.checked;
    };
    this.starlessGroup.title = "Generate Starless";
    this.starlessGroup.sizer = new VerticalSizer;
    this.starlessGroup.sizer.add(this.nbStarlessSizer);
    this.starlessGroup.sizer.add(this.bbStarlessSizer);
    this.starlessGroup.sizer.add(this.starXSizer);

    // --------------------------------------------------------------
    // Settings
    // --------------------------------------------------------------

    this.maxStarsLabel = new Label(this);
    this.maxStarsLabel.text = "Maximum Stars: ";
    this.maxStarsLabel.minWidth = labelWidth2;
    this.maxStarsLabel.maxWidth = labelWidth2;
    this.maxStarsLabel.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;

    this.maxStars = new NumericControl(this);
    this.maxStars.toolTip = "<p> This field controls the maximum number of stars that will be included in the calculation, "+
        "higher values will include more stars which will take longer, but may provide more accurate results."+
        "<p>Default value is 400 stars</p>";
    this.maxStars.setPrecision(2);
    this.maxStars.setRange(50, 1000);
    this.maxStars.setReal(true);
    this.maxStars.slider.stepSize = 0.1;
    this.maxStars.slider.setRange(0, 19);
    this.maxStars.setValue(ToolParameters.maxStars);
    this.maxStars.onValueUpdated = function (value) {
        ToolParameters.maxStars = value;
    };

    this.maxStarsSizer = new HorizontalSizer(this);
    this.maxStarsSizer.margin = 6;
    this.maxStarsSizer.add(this.maxStarsLabel, 1);
    this.maxStarsSizer.add(this.maxStars, 0);

    this.maxPeakLabel = new Label(this);
    this.maxPeakLabel.text = "Maximum Peak: ";
    this.maxPeakLabel.minWidth = labelWidth2;
    this.maxPeakLabel.maxWidth = labelWidth2;
    this.maxPeakLabel.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;

    this.maxPeak = new NumericControl(this);
    this.maxPeak.toolTip = "<p> This field controls the maximum peak value that a star can have to be included in the flux calculation, "+
        "higher values will be more tolerant of brighter stars and may begin to include saturated stars, which can degrade "+
        "the performance of the routine.</p>" +
        "<p>Default value is 0.8</p>";
    this.maxPeak.setPrecision(2);
    this.maxPeak.setRange(0, 1);
    this.maxPeak.setReal(true);
    this.maxPeak.slider.stepSize = 0.1;
    this.maxPeak.slider.setRange(0, 10);
    this.maxPeak.setValue(ToolParameters.maxPeak);
    this.maxPeak.onValueUpdated = function (value) {
        ToolParameters.maxPeak = value;
    };

    this.maxPeakSizer = new HorizontalSizer(this);
    this.maxPeakSizer.margin = 6;
    this.maxPeakSizer.add(this.maxPeakLabel, 1);
    this.maxPeakSizer.add(this.maxPeak, 0);

    this.generatePlotLabel = new Label(this);
    this.generatePlotLabel.toolTip = "<p>Plot narrowband flux vs. broadband flux. This can be useful for verifying the calculated fit and troubleshooting in the "+
        "event of poor subtraction. If the curve is non-linear, consider increasing the maximum number of stars.</p>";
    this.generatePlotLabel.text = "Generate Plot: ";
    this.generatePlotLabel.minWidth = labelWidth2;
    this.generatePlotLabel.maxWidth = labelWidth2;
    this.generatePlotLabel.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;

    this.generatePlotCheckBox = new CheckBox(this);
    this.generatePlotCheckBox.toolTip = "<p>Plot narrowband flux vs. broadband flux. This can be useful for verifying the calculated fit and troubleshooting in the "+
        "event of poor subtraction. If the curve is non-linear, consider increasing the maximum number of stars.</p>";
    this.generatePlotCheckBox.checked = ToolParameters.generatePlot;
    // this.generatePlotCheckBox.text = "Generate Plot";
    this.generatePlotCheckBox.onCheck = function () {
        ToolParameters.generatePlot = this.checked;
    };

    this.generatePlotSizer = new HorizontalSizer(this);
    this.generatePlotSizer.margin = 6;
    this.generatePlotSizer.add(this.generatePlotLabel, 1);
    this.generatePlotSizer.addSpacing(10);
    this.generatePlotSizer.add(this.generatePlotCheckBox, 0);

    // Group Sizer
    this.settingsGroup = new GroupBox(this);
    this.settingsGroup.title = "Settings";
    this.settingsGroup.sizer = new VerticalSizer;
    this.settingsGroup.sizer.add(this.maxStarsSizer);
    this.settingsGroup.sizer.add(this.maxPeakSizer);
    this.settingsGroup.sizer.add(this.generatePlotSizer);


    // --------------------------------------------------------------
    // Bottom Button Row
    // --------------------------------------------------------------

    this.newInstanceButton = new ToolButton(this);
    this.newInstanceButton.icon = this.scaledResource(":/process-interface/new-instance.png");
    this.newInstanceButton.setScaledFixedSize(20, 20);
    this.newInstanceButton.toolTip = "New Instance";
    this.newInstanceButton.onMousePress = function () {
        this.hasFocus = true;
        ToolParameters.save();
        this.pushed = false;
        this.dialog.newInstance();
    };

    this.docs_Button = new ToolButton(this);
    this.docs_Button.text = "Docs";
    this.docs_Button.icon = this.scaledResource(":/process-explorer/browse-documentation.png");
    this.docs_Button.onClick = function () {
        Dialog.openBrowser("https://nightphotons.com/software/photometric-continuum-subtraction/");
    };

    this.ok_Button = new PushButton(this);
    this.ok_Button.text = "Execute";
    this.ok_Button.icon = this.scaledResource(":/icons/ok.png");
    this.ok_Button.onClick = function () {
        this.dialog.ok();
    };

    this.cancel_Button = new PushButton(this);
    this.cancel_Button.text = "Cancel";
    this.cancel_Button.icon = this.scaledResource(":/icons/cancel.png");
    this.cancel_Button.onClick = function () {
        this.dialog.cancel();
    };

    this.buttons_Sizer = new HorizontalSizer;
    this.buttons_Sizer.scaledSpacing = 6;
    this.buttons_Sizer.add(this.newInstanceButton);
    this.buttons_Sizer.add(this.docs_Button);
    this.buttons_Sizer.addStretch();
    this.buttons_Sizer.add(this.ok_Button);
    this.buttons_Sizer.add(this.cancel_Button);

    // --------------------------------------------------------------
    // Global Sizer
    // --------------------------------------------------------------
    this.sizer = new VerticalSizer(this);
    this.sizer.margin = 6;
    this.sizer.spacing = 4;
    this.sizer.add(this.label);
    this.sizer.addSpacing(4);
    this.sizer.add(this.starGroup);
    this.sizer.addSpacing(4);
    this.sizer.add(this.starlessGroup);
    this.sizer.addSpacing(4);
    this.sizer.add(this.settingsGroup);
    this.sizer.addSpacing(4);
    this.sizer.addStretch();
    this.sizer.add(this.buttons_Sizer);
}
}; // end class MainDialog

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