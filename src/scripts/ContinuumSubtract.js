#include <pjsr/StdButton.jsh>
#include <pjsr/StdIcon.jsh>
#include <pjsr/Sizer.jsh>
#include <pjsr/NumericControl.jsh>

#feature-id    Utilities > ContinuumSubtract
#feature-info  Fully automatic continuum subtraction using a photometric calibration routine. Processes both star-contianing and starless images to produce subtracted images.

#define VERSION "1.0.0"

var ToolParameters = {
    nbStarView: undefined,
    bbStarView: undefined,
    nbStarlessView: undefined,
    bbStarlessView: undefined,
    starlessEnabled: false,
    maxStars: 200,
    maxFlux: 2.0,
    save: function () {
        if (ToolParameters.nbStarView != undefined && !ToolParameters.nbStarView.isNull) {
            Parameters.set("NarrowbandStarViewID", ToolParameters.nbStarView.id);
        }
        if (ToolParameters.bbStarView != undefined && !ToolParameters.bbStarView.isNull) {
            Parameters.set("BroadbandStarViewID", ToolParameters.bbStarView.id);
        }
        if (ToolParameters.nbStarlessView != undefined && !ToolParameters.nbStarlessView.isNull) {
            Parameters.set("NarrowbandStarlessViewID", ToolParameters.nbStarlessView.id);
        }
        if (ToolParameters.bbStarlessView != undefined && !ToolParameters.bbStarlessView.isNull) {
            Parameters.set("BroadbandStarlessViewID", ToolParameters.bbStarlessView.id);
        }
        Parameters.set("StarlessEnabled", ToolParameters.starlessEnabled);
        Parameters.set("MaximumStars", ToolParameters.maxStars);
        Parameters.set("MaximumFlux", ToolParameters.maxFlux);
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
        if (Parameters.has("MaximumStars")) {
            ToolParameters.maxStars = Parameters.getInteger("MaximumStars");
        }
        if (Parameters.has("MaximumFlux")) {
            ToolParameters.maxFlux = Parameters.getReal("MaximumFlux");
        }
    }
};

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
            console.errorln("Invalid colorspace for image: " + ToolParameters.nbStarView.id + ". Must be grayscale.");
            return;
        }
        if (!ToolParameters.bbStarView.image.isGrayscale) {
            console.errorln("Invalid colorspace for image: " + ToolParameters.bbStarView.id + ". Must be grayscale.");
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
                    console.errorln("Invalid colorspace for image: " + ToolParameters.nbStarlessView.id + ". Must be grayscale.");
                    generateStarless = false;
                }
                if (!ToolParameters.bbStarlessView.image.isGrayscale) {
                    console.errorln("Invalid colorspace for image: " + ToolParameters.bbStarlessView.id + ". Must be grayscale.");
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
    ratio = median(ratioList);
    SubtractImage(ToolParameters.nbStarView, ToolParameters.bbStarView, ratio, "NB_Stars");
    if (generateStarless) {
        SubtractImage(ToolParameters.nbStarlessView, ToolParameters.bbStarlessView, ratio, "NB_Starless");
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

function MainDialog() {
    this.__base__ = Dialog;
    this.__base__();

    var self = this;

    // Window parameters
    this.minWidth = 300;
    this.width = 400;
    var labelWidth1 = this.font.width("Narrowband:");
    var labelWidth2 = this.font.width("Maximum Stars: ");



    // --------------------------------------------------------------
    // Description & Title
    // --------------------------------------------------------------
    this.label = new Label(this);
    with (this.label) {
        wordWrapping = true;
        useRichText = true;
        margin = 4;
        text = "<b>ContinuumSubtract v" + VERSION + "</b> | Charles Hagen<br></br><br></br>"
            + "Provide narrowband and continuum images as well as the starless images "
            + "(optional) for subtraction. The script will generate an image for both the star-"
            + "containing image, as well as the starless image if enabled. Create a process icon "
            + "with the view IDs and apply as a process icon to run without opening the dialog.";
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
        titleCheckBox = true;
        checked = ToolParameters.starlessEnabled;
        onCheck = function () {
            ToolParameters.starlessEnabled = !ToolParameters.starlessEnabled;
        }
        title = "Starless Views";
        sizer = new VerticalSizer;
    }
    with (this.starlessGroup.sizer) {
        add(this.nbStarlessSizer);
        add(this.bbStarlessSizer);
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
        // toolTip = "Increase to include more stars in the calculation. Default is 200.";
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

    this.maxFluxLabel = new Label(this);
    with (this.maxFluxLabel) {
        text = "Maximum Flux: ";
        minWidth = labelWidth2;
        maxWidth = labelWidth2;
        textAlignment = TextAlign_Right | TextAlign_VertCenter;
    }

    this.maxFlux = new NumericControl(this);
    with (this.maxFlux) {
        // toolTip = "Increase to include brighter stars. Using clipped stars can cause inaccuracy. Default is 2.";
        setPrecision(2);
        setRange(0.8, 5);
        setReal(true);
        slider.stepSize = 0.1;
        slider.setRange(0, 42);
        setValue(ToolParameters.maxFlux);
        onValueUpdated = function (value) {
            ToolParameters.maxFlux = value;
        }
    }

    this.maxFluxSizer = new HorizontalSizer(this);
    with (this.maxFluxSizer) {
        margin = 6;
        add(this.maxFluxLabel, 1);
        add(this.maxFlux, 0);
    }

    // Group Sizer
    this.settingsGroup = new GroupBox(this)
    with (this.settingsGroup) {
        title = "Settings";
        sizer = new VerticalSizer;
    }
    with (this.settingsGroup.sizer) {
        add(this.maxStarsSizer);
        add(this.maxFluxSizer);
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
        ToolParameters.load();
        // ToolParameters.nbStarlessView = Parameters.targetView; //Parameters.targetView is the image being applied to
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
