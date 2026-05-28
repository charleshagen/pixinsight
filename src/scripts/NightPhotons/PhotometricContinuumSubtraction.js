#engine v8

#feature-id    PhotometricContinuumSubtraction : NightPhotons > PhotometricContinuumSubtraction
#feature-icon  @script_icons_dir/PhotometricContinuumSubtraction.svg
#feature-info  Fully automatic continuum subtraction using a photometric calibration routine. Supports multiple broadband channels with optimized weighting. Processes both star-containing and starless images to produce continuum-free narrowband images.

CoreApplication.ensureMinimumVersion( 1, 9, 4 );

#define TITLE "PhotometricContinuumSubtraction"
#define VERSION "1.4.0"

var ToolParameters = {
    nbStarView:        undefined,
    bbChannels:        [],
    starlessEnabled:   false,
    starRemovalMethod: 1,
    maxStars:          400,
    maxPeak:           0.8,
    generatePlot:      true,
    keepComposite:     false,

    save: function () {
        if (ToolParameters.nbStarView != null && ToolParameters.nbStarView != undefined) {
            Parameters.set("NarrowbandStarViewID", ToolParameters.nbStarView.id);
        } else {
            Parameters.remove("NarrowbandStarViewID");
        }
        // Serialize broadband channels as semicolon-delimited view IDs
        let channelStr = ToolParameters.bbChannels
            .filter(ch => ch.starView != null && ch.starView != undefined)
            .map(ch => ch.starView.id)
            .join(";");
        Parameters.set("BroadbandChannels",  channelStr);
        Parameters.set("StarlessEnabled",    ToolParameters.starlessEnabled);
        Parameters.set("StarRemovalMethod",  ToolParameters.starRemovalMethod);
        Parameters.set("MaximumStars",       ToolParameters.maxStars);
        Parameters.set("MaximumPeak",        ToolParameters.maxPeak);
        Parameters.set("GeneratePlot",       ToolParameters.generatePlot);
        Parameters.set("KeepComposite",      ToolParameters.keepComposite);
    },

    load: function () {
        if (Parameters.has("NarrowbandStarViewID")) {
            let v = View.viewById(Parameters.getString("NarrowbandStarViewID"));
            ToolParameters.nbStarView = (v != null) ? v : undefined;
            if (v == null)
                console.warningln("Could not find view: \"" + Parameters.getString("NarrowbandStarViewID") + "\"");
        }
        if (Parameters.has("BroadbandChannels")) {
            ToolParameters.bbChannels = [];
            let parts = Parameters.getString("BroadbandChannels").split(";");
            for (let i = 0; i < parts.length; ++i) {
                if (parts[i] === "") continue;
                let v = View.viewById(parts[i]);
                if (v != null)
                    ToolParameters.bbChannels.push({ starView: v });
                else
                    console.warningln("Could not find broadband view: \"" + parts[i] + "\"");
            }
        }
        if (Parameters.has("StarlessEnabled"))   ToolParameters.starlessEnabled   = Parameters.getBoolean("StarlessEnabled");
        if (Parameters.has("StarRemovalMethod")) ToolParameters.starRemovalMethod  = Parameters.getInteger("StarRemovalMethod");
        if (Parameters.has("MaximumStars"))      ToolParameters.maxStars           = Parameters.getInteger("MaximumStars");
        if (Parameters.has("MaximumPeak"))       ToolParameters.maxPeak            = Parameters.getReal("MaximumPeak");
        if (Parameters.has("GeneratePlot"))      ToolParameters.generatePlot       = Parameters.getBoolean("GeneratePlot");
        if (Parameters.has("KeepComposite"))     ToolParameters.keepComposite      = Parameters.getBoolean("KeepComposite");
    }
};

// ---------------------------------------------------------------------------
// optimizeWeights
//
// Computes a robust multi-channel linear fit (w, k) to map bbFluxes to nbFluxes 
// with a through-origin regression (no intercept) using IRLS with Tukey biweights 
// for outlier rejection and constrained gradient descent.
// ---------------------------------------------------------------------------
function optimizeWeights(bbFluxes, nbFluxes) {
    let nStars    = nbFluxes.length;
    let nChannels = bbFluxes[0].length;
    const TUKEY_C = 4.685;

    // Project onto affine hyperplane
    function projectHyperplane(v) {
        let shift = (v.reduce((a, b) => a + b, 0) - 1) / v.length;
        return v.map(x => x - shift);
    }

    function solveWeighted(starWeights) {
        let gramMatrix = [], crossProducts = [], nbSumOfSquares = 0;
        for (let c = 0; c < nChannels; ++c) {
            gramMatrix.push(new Array(nChannels).fill(0));
            crossProducts.push(0);
        }
        for (let i = 0; i < nStars; ++i) {
            let weight = starWeights[i];
            if (weight === 0) continue;
            nbSumOfSquares += weight * nbFluxes[i] * nbFluxes[i];
            for (let c = 0; c < nChannels; ++c) {
                crossProducts[c] += weight * bbFluxes[i][c] * nbFluxes[i];
                for (let d = 0; d < nChannels; ++d)
                    gramMatrix[c][d] += weight * bbFluxes[i][c] * bbFluxes[i][d];
            }
        }

        if (nChannels === 1) {
            let k = (gramMatrix[0][0] > 0) ? crossProducts[0] / gramMatrix[0][0] : 1;
            return { w: [1.0], k: k };
        }

        function wRssAndGrad(w) {
            let weightedCross = 0;
            for (let c = 0; c < nChannels; ++c) weightedCross += w[c] * crossProducts[c];
            let weightedGram = 0;
            for (let c = 0; c < nChannels; ++c)
                for (let d = 0; d < nChannels; ++d)
                    weightedGram += w[c] * w[d] * gramMatrix[c][d];
            if (weightedGram <= 0) return { rss: nbSumOfSquares, grad: new Array(nChannels).fill(0), k: 0 };
            let k = weightedCross / weightedGram;
            let rss = nbSumOfSquares - weightedCross * weightedCross / weightedGram;
            let grad = [];
            for (let c = 0; c < nChannels; ++c) {
                let gramRow = 0;
                for (let d = 0; d < nChannels; ++d) gramRow += w[d] * gramMatrix[c][d];
                grad.push(2.0 * k * (k * gramRow - crossProducts[c]) / weightedGram);
            }
            return { rss: rss, grad: grad, k: k };
        }

        let w = new Array(nChannels).fill(1.0 / nChannels);
        let learningRate = 0.01, prevResidualSumSq = Infinity;
        for (let iter = 0; iter < 2000; ++iter) {
            let current = wRssAndGrad(w);
            if (Math.abs(prevResidualSumSq - current.rss) < 1e-12) break;
            prevResidualSumSq = current.rss;
            let stepSize = learningRate;
            for (let lineSearchIter = 0; lineSearchIter < 20; ++lineSearchIter) {
                let trialWeights  = projectHyperplane(w.map((wi, c) => wi - stepSize * current.grad[c]));
                let trialResidualSumSq = wRssAndGrad(trialWeights).rss;
                let expectedDecrease   = current.grad.reduce((s, g, c) => s + g * (trialWeights[c] - w[c]), 0);
                if (trialResidualSumSq < current.rss + 1e-4 * stepSize * expectedDecrease) {
                    w = trialWeights; learningRate = stepSize * 1.2; break;
                }
                stepSize *= 0.5;
            }
        }
        return { w: w, k: wRssAndGrad(w).k };
    }

    function residuals(w, k) {
        return nbFluxes.map(function(nb, i) {
            let bbComposite = 0;
            for (let c = 0; c < nChannels; ++c) bbComposite += w[c] * bbFluxes[i][c];
            return nb - k * bbComposite;
        });
    }

    function madScale(values) {
        let mad = median(values.map(Math.abs));
        return mad / 0.6745;
    }

    function tukeyWeights(values, sigma) {
        if (sigma <= 0) return new Array(values.length).fill(1);
        return values.map(function(residual) {
            let normalizedResidual = residual / (TUKEY_C * sigma);
            return (Math.abs(normalizedResidual) < 1) ? Math.pow(1 - normalizedResidual * normalizedResidual, 2) : 0;
        });
    }

    let starWeights = new Array(nStars).fill(1.0);
    let solution = solveWeighted(starWeights);
    let prevWeights = solution.w.slice(), prevScale = solution.k;
    const MAX_IRLS = 30;

    for (let irlsIter = 0; irlsIter < MAX_IRLS; ++irlsIter) {
        let currentResiduals = residuals(solution.w, solution.k);
        let sigma = madScale(currentResiduals);
        if (sigma < 1e-14) break;
        starWeights = tukeyWeights(currentResiduals, sigma);
        let numActiveStars = starWeights.filter(w => w > 0).length;
        if (numActiveStars < Math.max(10, 0.1 * nStars)) {
            console.warningln("IRLS: too few inliers (" + numActiveStars + "), stopping early.");
            break;
        }
        solution = solveWeighted(starWeights);
        let maxWeightDelta = solution.w.reduce((m, wi, c) => Math.max(m, Math.abs(wi - prevWeights[c])), 0);
        let scaleDelta     = Math.abs(solution.k - prevScale) / (Math.abs(prevScale) + 1e-12);
        if (maxWeightDelta < 1e-6 && scaleDelta < 1e-6) break;
        prevWeights = solution.w.slice();
        prevScale = solution.k;
    }

    let numInliers = starWeights.filter(w => w > 1e-4).length;
    console.noteln(format("  Robust fit: %d / %d stars used as inliers (Tukey c=%.3f)",
        numInliers, nStars, TUKEY_C));
    return { weights: solution.w, scale: solution.k, starWeights: starWeights };
}


// ---------------------------------------------------------------------------
// continuumSubtract
// ---------------------------------------------------------------------------
function continuumSubtract() {
    // Input validation
    if (ToolParameters.nbStarView == null || ToolParameters.nbStarView == undefined) {
        console.criticalln("Error: Narrowband image is not defined.");
        console.show(); return;
    }
    if (!ToolParameters.nbStarView.image.isGrayscale) {
        console.criticalln("Invalid colorspace for narrowband image: " + ToolParameters.nbStarView.id + ". Must be grayscale.");
        console.show(); return;
    }
    if (ToolParameters.bbChannels.length === 0) {
        console.criticalln("Error: No broadband channels defined.");
        console.show(); return;
    }
    for (let i = 0; i < ToolParameters.bbChannels.length; ++i) {
        let ch = ToolParameters.bbChannels[i];
        if (ch.starView == null || ch.starView == undefined) {
            console.criticalln("Error: Broadband channel " + (i + 1) + " has no view assigned.");
            console.show(); return;
        }
        if (!ch.starView.image.isGrayscale) {
            console.criticalln("Invalid colorspace for broadband channel " + (i + 1) + ": " + ch.starView.id + ". Must be grayscale.");
            console.show(); return;
        }
    }

    let bbStarViews = ToolParameters.bbChannels.map(ch => ch.starView);
    let nChannels   = bbStarViews.length;

    // Star detection on a temporary average of all broadband channels
    let detectionView = bbStarViews[0]; // fallback for single-channel case
    if (nChannels > 1) {
        let detExpr   = "(" + bbStarViews.map(v => v.id).join("+") + ")/" + nChannels;
        let detCompId = generateValidID("_pcs_detection");
        let Pdet = new PixelMath;
        Pdet.expression          = detExpr;
        Pdet.useSingleExpression = true;
        Pdet.generateOutput      = true;
        Pdet.optimization        = true;
        Pdet.createNewImage      = true;
        Pdet.showNewImage        = false;
        Pdet.newImageId          = detCompId;
        Pdet.newImageColorSpace  = PixelMath.Gray;
        Pdet.executeOn(bbStarViews[0]);
        let v = View.viewById(detCompId);
        if (v != null) detectionView = v;
        else console.warningln("Warning: Could not create detection composite; falling back to first channel.");
    }

    let stars = detectStars(detectionView.image);
    if (nChannels > 1 && detectionView !== bbStarViews[0]) detectionView.window.forceClose();

    if (stars.length === 0) {
        console.criticalln("Error: No stars detected. Try adjusting the maximum star peak parameter.");
        console.show(); return;
    }

    // PSF fitting 
    let narrowbandPSF = generatePSFs(ToolParameters.nbStarView, stars);
    let bbPSFs = bbStarViews.map(v => generatePSFs(v, stars));

    // Assemble per-star flux arrays
    let nStars       = stars.length;
    let nbFluxByIdx  = new Array(nStars).fill(null);
    let bbFluxByIdx  = [];
    for (let i = 0; i < nStars; ++i) bbFluxByIdx.push(new Array(nChannels).fill(null));

    for (let i = 0; i < narrowbandPSF.length; ++i)
        nbFluxByIdx[narrowbandPSF[i][0]] = narrowbandPSF[i][16];
    for (let c = 0; c < nChannels; ++c)
        for (let i = 0; i < bbPSFs[c].length; ++i)
            bbFluxByIdx[bbPSFs[c][i][0]][c] = bbPSFs[c][i][16];

    let validNB = [], validBB = [];
    for (let i = 0; i < nStars; ++i) {
        if (nbFluxByIdx[i] === null) continue;
        let allValid = bbFluxByIdx[i].every(v => v !== null);
        if (allValid) {
            validNB.push(nbFluxByIdx[i]);
            validBB.push(bbFluxByIdx[i].slice());
        }
    }

    if (validNB.length === 0) {
        console.criticalln("Error: No valid star pairs detected across all channels.");
        console.show(); return;
    }
    if (validNB.length < 50)
        console.warningln("Warning: Only " + validNB.length + " valid star sets found. Results may be inaccurate.");

    // Optimise weights 
    console.writeln("Optimising broadband channel weights (" + nChannels + " channel" + (nChannels > 1 ? "s" : "") + ")...");
    let optResult = optimizeWeights(validBB, validNB);
    let weights   = optResult.weights;
    let scale     = optResult.scale;

    console.noteln("Optimised broadband weights:");
    for (let c = 0; c < nChannels; ++c)
        console.noteln(format("  Channel %d (%s): w = %.4f", c + 1, bbStarViews[c].id, weights[c]));
    console.noteln(format("  Scale factor k = %.6f  (NB ≈ k · composite_BB)", scale));

    let compositeExpr = buildCompositeExpression(bbStarViews, weights);
    let compBBId      = generateValidID("composite_bb_" + ToolParameters.nbStarView.id);
    let Pcomp         = new PixelMath;
    Pcomp.expression          = compositeExpr;
    Pcomp.useSingleExpression = true;
    Pcomp.generateOutput      = true;
    Pcomp.optimization        = true;
    Pcomp.createNewImage      = true;
    Pcomp.showNewImage        = false;
    Pcomp.newImageId          = compBBId;
    Pcomp.newImageColorSpace  = PixelMath.Gray;
    Pcomp.executeOn(bbStarViews[0]);
    let compBBView = View.viewById(compBBId);
    if (compBBView == null) {
        console.criticalln("Error: Failed to create composite broadband image.");
        console.show(); return;
    }
    console.noteln("Composite broadband image created: " + compBBId);

    let tempViews = []; // collect all intermediates for cleanup (compBBView handled separately)

    // Star-containing subtraction
    let starSubExpr = ToolParameters.nbStarView.id +
        "-" + format("%.6f", scale) + "*(" + compBBId + "-med(" + compBBId + "))";
    let starID = generateValidID(ToolParameters.nbStarView.id + "_sub");
    subtractImageExpression(ToolParameters.nbStarView, starSubExpr, starID);
    applyAstrometricSolution(starID);

    // Starless subtraction
    if (ToolParameters.starlessEnabled && ToolParameters.starRemovalMethod !== 0) {

        // Remove stars from the composite broadband image
        let compBBStarlessView = cloneView(compBBView, generateValidID(compBBId + "_starless"));
        if (compBBStarlessView == null || !removeStars(compBBStarlessView)) {
            console.warningln("Warning: Star removal failed on composite broadband. Skipping starless output.");
            for (let v of tempViews) v.window.forceClose();
            return;
        }
        tempViews.push(compBBStarlessView);

        // Remove stars from the narrowband image
        let nbStarlessView = cloneView(ToolParameters.nbStarView,
            generateValidID(ToolParameters.nbStarView.id + "_starless"));
        if (nbStarlessView == null || !removeStars(nbStarlessView)) {
            console.warningln("Warning: Star removal failed on narrowband. Skipping starless output.");
            for (let v of tempViews) v.window.forceClose();
            return;
        }
        tempViews.push(nbStarlessView);

        // Subtract NB_starless
        let slSubExpr = nbStarlessView.id +
            "-" + format("%.6f", scale) +
            "*(" + compBBStarlessView.id + "-med(" + compBBView.id + "))"; // Subtract the same median as the star-in 
        let starlessID = generateValidID(ToolParameters.nbStarView.id + "_sub_starless");
        subtractImageExpression(nbStarlessView, slSubExpr, starlessID);
        applyAstrometricSolution(starlessID);

    } else if (ToolParameters.starlessEnabled && ToolParameters.starRemovalMethod === 0) {
        console.warningln("Warning: Starless enabled but no star removal method selected. Skipping starless output.");
        console.show();
    }

    // Dispose of all intermediate views
    for (let v of tempViews) {
        console.writeln("Cleaning up: " + v.id);
        v.window.forceClose();
    }

    // Keep or discard the composite broadband image
    if (ToolParameters.keepComposite) {
        let Pscale = new PixelMath;
        Pscale.expression         = compBBView.id + "*" + format("%.6f", scale);
        Pscale.useSingleExpression = true;
        Pscale.generateOutput      = true;
        Pscale.optimization        = true;
        Pscale.createNewImage      = false;
        Pscale.executeOn(compBBView);
        compBBView.window.show();
        console.noteln("Composite broadband image kept: " + compBBView.id);
    } else {
        compBBView.window.forceClose();
    }

    // Diagnostic plot
    if (ToolParameters.generatePlot) {
        let compositeFluxes = validBB.map(function(bbRow) {
            let c = 0;
            for (let ch = 0; ch < nChannels; ++ch) c += weights[ch] * bbRow[ch];
            return c;
        });

        let tmpDir        = File.systemTempDirectory;
        let inlierPath    = tmpDir + "/pcs_inliers.dat";
        let outlierPath   = tmpDir + "/pcs_outliers.dat";
        let trendPath     = tmpDir + "/pcs_trendline.dat";
        let gnuPath       = tmpDir + "/pcs_fluxes.gnu";
        let svgPath       = tmpDir + "/PCS_plot.svg";

        const INLIER_THRESHOLD = 0.1;
        let xIn = [], yIn = [], xOut = [], yOut = [];
        for (let i = 0; i < compositeFluxes.length; ++i) {
            if (optResult.starWeights[i] > INLIER_THRESHOLD) {
                xIn.push(compositeFluxes[i]); yIn.push(validNB[i]);
            } else {
                xOut.push(compositeFluxes[i]); yOut.push(validNB[i]);
            }
        }

        let xQ = quartiles(compositeFluxes), yQ = quartiles(validNB);
        let minX = xQ[1] * 0.5, maxX = xQ[3] * 2.0;
        let minY = yQ[1] * 0.5, maxY = yQ[3] * 2.0;

        let f = new File;
        f.createForWriting(inlierPath);
        for (let i = 0; i < xIn.length; ++i) f.outTextLn(format("%.4f %.4f", xIn[i], yIn[i]));
        f.close();

        f = new File;
        f.createForWriting(outlierPath);
        for (let i = 0; i < xOut.length; ++i) f.outTextLn(format("%.4f %.4f", xOut[i], yOut[i]));
        f.close();

        f = new File;
        f.createForWriting(trendPath);
        f.outTextLn("0 0");
        if (maxX * scale < maxY)
            f.outTextLn(format("%.4f %.4f", 0.99 * maxX, 0.99 * maxX * scale));
        else
            f.outTextLn(format("%.4f %.4f", 0.99 * maxY / scale, 0.99 * maxY));
        f.close();

        let weightLabel = bbStarViews.map((v, i) => format("%s: %.3f", v.id, weights[i])).join(", ");

        f = new File;
        f.createForWriting(gnuPath);
        f.outTextLn("set terminal svg size 640,640 enhanced font 'helvetica,12' background rgb 'white'");
        f.outTextLn("set title 'Composite Broadband Flux vs. Narrowband Flux' font 'helvetica,16'");
        f.outTextLn("set grid");
        f.outTextLn("set key bottom right");
        f.outTextLn("set xlabel \"Composite Broadband Flux\"");
        f.outTextLn("set ylabel \"Narrowband Flux\"");
        f.outTextLn("set xrange [" + minX.toFixed(4) + ":" + maxX.toFixed(4) + "]");
        f.outTextLn("set yrange [" + minY.toFixed(4) + ":" + maxY.toFixed(4) + "]");
        f.outTextLn("set output '" + svgPath + "'");
        let plotParts = [];
        if (xIn.length  > 0) plotParts.push("'" + inlierPath  + "' with points lc rgbcolor '#158cdb' title 'Inliers ("  + xIn.length  + ")'");
        if (xOut.length > 0) plotParts.push("'" + outlierPath + "' with points lc rgbcolor '#ff0000' title 'Outliers (" + xOut.length + ")'");
        plotParts.push("'" + trendPath + "' with lines lw 2 lc rgbcolor '#0000ca' title 'Fit (k=" + format("%.3f", scale) + ")'");
        f.outTextLn("plot " + plotParts.join(", \\\n     "));
        f.close();

        run("\"" + System.getEnvironmentVariable("PXI_BINDIR") + "/gnuplot\" \"" + gnuPath + "\"");
        ImageWindow.open(svgPath, generateValidID("PCS_Flux_Plot"))[0].show();
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function detectStars(sourceImage) {
    let detector        = new StarDetector;
    detector.upperLimit = ToolParameters.maxPeak;
    let lastProgressPc  = 0;
    detector.progressCallback = (count, total) => {
        if (count === 0) {
            console.write("<end><cbr>Detecting stars:   0%");
            lastProgressPc = 0; CoreApplication.processEvents();
        } else {
            let pc = Math.round(100 * count / total);
            if (pc > lastProgressPc) {
                console.write(format("<end>\b\b\b\b%3d%%", pc));
                lastProgressPc = pc; CoreApplication.processEvents();
            }
        }
        return true;
    };
    let S = detector.stars(sourceImage);
    console.writeln(""); console.writeln("Stars detected: " + S.length);
    let stars = [], radius = 2, numStars = Math.min(S.length, ToolParameters.maxStars);
    for (let i = 0; i < numStars; ++i)
        stars.push([0, 0, DynamicPSF.Star_DetectedOk,
            S[i].pos.x - radius, S[i].pos.y - radius,
            S[i].pos.x + radius, S[i].pos.y + radius,
            S[i].pos.x, S[i].pos.y]);
    return stars;
}

function generatePSFs(sourceView, starsList) {
    let P = new DynamicPSF;
    P.views = [[sourceView.id]]; P.astrometry = false; P.autoAperture = true;
    P.searchRadius = 2; P.circularPSF = false; P.autoPSF = false;
    P.gaussianPSF = true; P.moffatPSF = false; P.moffat10PSF = false;
    P.moffat8PSF = false; P.moffat6PSF = false; P.moffat4PSF = false;
    P.moffat25PSF = false; P.moffat15PSF = false; P.lorentzianPSF = false;
    P.variableShapePSF = false; P.stars = starsList; P.executeGlobal();
    return P.psf;
}

function buildCompositeExpression(bbViews, weights) {
    if (bbViews.length === 1) return bbViews[0].id;
    return "(" + bbViews.map((v, i) => format("%.6f*%s", weights[i], v.id)).join("+") + ")";
}

function subtractImageExpression(nbView, expr, newId) {
    let P = new PixelMath;
    P.expression = expr; P.useSingleExpression = true;
    P.generateOutput = true; P.optimization = true;
    P.createNewImage = true; P.showNewImage = true;
    P.newImageId = newId; P.newImageColorSpace = PixelMath.Gray;
    P.executeOn(nbView);
}

function generateValidID(id) {
    if (View.viewById(id) == null) return id;
    let n = 1, newID;
    do { newID = id + n; ++n; } while (View.viewById(newID) != null);
    return newID;
}

function applyAstrometricSolution(id) {
    let view = View.viewById(id);
    if (view == null) return;
    if (ToolParameters.nbStarView.window.hasAstrometricSolution) {
        view.window.copyAstrometricSolution(ToolParameters.nbStarView.window);
        console.noteln(id + ": Astrometric solution copied from " + ToolParameters.nbStarView.id);
    } else if (ToolParameters.bbChannels.length > 0 &&
               ToolParameters.bbChannels[0].starView.window.hasAstrometricSolution) {
        view.window.copyAstrometricSolution(ToolParameters.bbChannels[0].starView.window);
        console.noteln(id + ": Astrometric solution copied from " + ToolParameters.bbChannels[0].starView.id);
    }
}

function median(arr) {
    if (arr.length === 0) return null;
    let s = arr.slice().sort((a, b) => a - b), mid = Math.floor(s.length / 2);
    return (s.length % 2 === 0) ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function quartiles(arr) {
    if (arr.length === 0) return null;
    let s = arr.slice().sort((a, b) => a - b);
    let q1 = Math.floor(s.length / 4), q2 = Math.floor(s.length / 2), q3 = Math.ceil(s.length * 3 / 4);
    return [s[0],
        s.length % 2 === 0 ? (s[q1-1]+s[q1])/2 : s[q1],
        s.length % 2 === 0 ? (s[q2-1]+s[q2])/2 : s[q2],
        s.length % 2 === 0 ? (s[q3-1]+s[q3])/2 : s[q3],
        s[s.length-1]];
}

function removeStars(view) {
    switch (ToolParameters.starRemovalMethod) {
        case 1:
            try {
                let P = new StarXTerminator;
                P.ai_file = "StarXTerminator.11.pb";
                P.stars = false; P.unscreen = false; P.overlap = 0.20;
                P.executeOn(view); return true;
            } catch (e) {
                console.criticalln("Could not remove stars. Ensure StarXTerminator is installed.");
                console.criticalln(e); console.show(); return false;
            }
        case 2:
            try {
                let P = new StarNet2;
                P.stride = StarNet2.defStride; P.mask = false; P.linear = true;
                P.upsample = false; P.shadows_clipping = -2.80; P.target_background = 0.25;
                P.executeOn(view); return true;
            } catch (e) {
                console.criticalln("Could not remove stars. Ensure StarNet2 is installed.");
                console.criticalln(e); console.show(); return false;
            }
        default: return false;
    }
}

function cloneView(view, newId) {
    try {
        let w = new ImageWindow(1, 1, 1, view.window.bitsPerSample,
            view.window.isFloatSample, view.image.isColor, newId);
        w.mainView.beginProcess(UndoFlag.NoSwapFile);
        w.mainView.image.assign(view.image);
        w.mainView.endProcess();
        w.mainView.stf = view.stf;
        return w.mainView;
    } catch (e) { console.criticalln(e); }
    return null;
}

function run(program, maxRunningTimeSec) {
    if (maxRunningTimeSec === undefined) maxRunningTimeSec = 10;
    let P = new ExternalProcess(program);
    if (P.waitForStarted()) {
        CoreApplication.processEvents();
        let n = 0, nmax = Math.round(maxRunningTimeSec * 1000 / 250);
        for (; n < nmax && !P.waitForFinished(250); ++n) {
            console.write("<end>\b" + "-/|\\".charAt(n % 4)); CoreApplication.processEvents();
        }
        if (n > 0) console.writeln("<end>\b");
    }
    if (P.exitStatus == ProcessExitStatus.Crash || P.exitCode != 0) {
        let e = P.stderr;
        throw new Error("Process failed:\n" + program + (e.length > 0 ? "\n" + e : ""));
    }
}

// ---------------------------------------------------------------------------
// Dialog
// ---------------------------------------------------------------------------

var MainDialog = class extends Dialog {
constructor() {
    super();
    var self = this;

    this.windowTitle = TITLE;
    var labelWidth1 = this.font.width("Narrowband:") + 8;
    var labelWidth2 = this.font.width("Keep Composite: ");
    this.width = 500;

    // --------------------------------------------------------------
    // Description & Title
    // --------------------------------------------------------------
    this.label = new Label(this);
    this.label.wordWrapping = true;
    this.label.useRichText  = true;
    this.label.margin       = 4;
    this.label.text =
        "<p><b>PhotometricContinuumSubtraction v" + VERSION + "</b> | Charles Hagen</p>" +
        "<p>Select a narrowband image and one or more broadband channels. " +
        "Select a view in the broadband picker and click the plus to add the view to the broadband list. " +
        "When multiple broadband channels are given, weights are optimised so the composite continuum " +
        "best fits narrowband stellar flux via a through-origin robust regression.</p>" +
        "<p><i>Create a process icon to run without opening the dialog.</i></p>";


    // ------------------------------------------------------------------
    // Source Views
    // ------------------------------------------------------------------

    // Narrowband View Selector
    this.nbStarLabel = new Label(this);
    this.nbStarLabel.text          = "Narrowband:";
    this.nbStarLabel.minWidth      = labelWidth1;
    this.nbStarLabel.maxWidth      = labelWidth1;
    this.nbStarLabel.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;

    this.nbStarViewList = new ViewList(this);
    this.nbStarViewList.getMainViews();
    this.nbStarViewList.onViewSelected = function (view) {
        ToolParameters.nbStarView = view.isNull ? undefined : view;
    };
    if (ToolParameters.nbStarView != null && ToolParameters.nbStarView != undefined)
        this.nbStarViewList.currentView = ToolParameters.nbStarView;

    this.nbStarSetActiveButton = new ToolButton(this);
    this.nbStarSetActiveButton.icon = this.scaledResource(":/icons/select-view.png");
    this.nbStarSetActiveButton.setScaledFixedSize(20, 20);
    this.nbStarSetActiveButton.toolTip = "Set active window as target";
    this.nbStarSetActiveButton.onClick = function () {
        ToolParameters.nbStarView = ImageWindow.activeWindow.currentView;
        self.nbStarViewList.currentView = ToolParameters.nbStarView;
    };

    this.nbStarSizer = new HorizontalSizer(this);
    this.nbStarSizer.margin  = 4;
    this.nbStarSizer.spacing = 4;
    this.nbStarSizer.add(this.nbStarLabel, 0);
    this.nbStarSizer.add(this.nbStarViewList, 1);
    this.nbStarSizer.add(this.nbStarSetActiveButton, 0);

    // Broadband View Selector
    this.bbStarLabel = new Label(this);
    this.bbStarLabel.text          = "Broadband:";
    this.bbStarLabel.minWidth      = labelWidth1;
    this.bbStarLabel.maxWidth      = labelWidth1;
    this.bbStarLabel.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;

    this.bbPickerViewList = new ViewList(this);
    this.bbPickerViewList.getMainViews();
    this.bbPickerViewList.toolTip = "<p>Select a broadband view to add as a channel.</p>";

    this.bbAddButton = new ToolButton(this);
    this.bbAddButton.icon = this.scaledResource(":/icons/add.png");
    this.bbAddButton.setScaledFixedSize(20, 20);
    this.bbAddButton.toolTip = "<p>Add the selected view as a broadband channel.</p>";
    this.bbAddButton.onClick = function () {
        let view = self.bbPickerViewList.currentView;
        if (view == null || view.isNull) return;
        // Avoid duplicates
        for (let i = 0; i < ToolParameters.bbChannels.length; ++i) {
            if (ToolParameters.bbChannels[i].starView != null &&
                ToolParameters.bbChannels[i].starView.id === view.id) {
                console.warningln("PCS: " + view.id + " is already in the channel list.");
                return;
            }
        }
        ToolParameters.bbChannels.push({ starView: view });
        self.refreshBBList();
        // Select the new row
        let last = self.bbListBox.child(self.bbListBox.numberOfChildren - 1);
        if (last != null) last.selected = true;
        self.bbRemoveButton.enabled = true;
    };

    this.bbPickerSizer = new HorizontalSizer(this);
    this.bbPickerSizer.margin  = 4;
    this.bbPickerSizer.spacing = 4;
    this.bbPickerSizer.add(this.bbStarLabel, 0);
    this.bbPickerSizer.add(this.bbPickerViewList, 1);
    this.bbPickerSizer.add(this.bbAddButton, 0);

    // TreeBox
    this.bbListBox = new TreeBox(this);
    this.bbListBox.numberOfColumns  = 2;
    this.bbListBox.setHeaderText(0, "#");
    this.bbListBox.setHeaderText(1, "Broadband View");
    this.bbListBox.setColumnWidth(0, this.font.width("###") + 8);
    this.bbListBox.setColumnWidth(1, this.font.width("_".repeat(36)));
    this.bbListBox.headerVisible    = true;
    this.bbListBox.rootDecoration   = false;
    this.bbListBox.alternateRowColor= false;
    this.bbListBox.multipleSelection= false;
    this.bbListBox.setScaledMinHeight(120);
    this.bbListBox.toolTip = "<p>List of broadband channels. Select a row and click Remove to delete it.</p>";
    this.bbListBox.onCurrentNodeUpdated = function () {
        self.bbRemoveButton.enabled = (self.bbListBox.currentNode != null &&
                                       ToolParameters.bbChannels.length > 0);
    };

    // Refresh helper function
    this.refreshBBList = function () {
        self.bbListBox.clear();
        for (let i = 0; i < ToolParameters.bbChannels.length; ++i) {
            let channel = ToolParameters.bbChannels[i];
            let node = new TreeBoxNode(self.bbListBox);
            node.setText(0, String(i + 1));
            node.setText(1, (channel.starView != null && channel.starView != undefined)
                ? channel.starView.id : "<none>");
        }
        self.bbRemoveButton.enabled = false;
    };

    // Remove selected button
    this.bbRemoveButton = new PushButton(this);
    this.bbRemoveButton.text    = "Remove Selected";
    this.bbRemoveButton.icon    = this.scaledResource(":/icons/remove.png");
    this.bbRemoveButton.enabled = false;
    this.bbRemoveButton.toolTip = "<p>Remove the selected broadband channel from the list.</p>";
    this.bbRemoveButton.onClick = function () {
        let node = self.bbListBox.currentNode;
        if (node == null) { // Get highlighted item if none are selected
            for (let i = 0; i < self.bbListBox.numberOfChildren; ++i) {
                if (self.bbListBox.child(i).selected) { node = self.bbListBox.child(i); break; }
            }
        }
        if (node == null) return;
        let idx = self.bbListBox.childIndex(node);
        if (idx < 0 || idx >= ToolParameters.bbChannels.length) return;
        ToolParameters.bbChannels.splice(idx, 1);
        self.refreshBBList();
    };

    this.bbRemoveSizer = new HorizontalSizer(this);
    this.bbRemoveSizer.addStretch();
    this.bbRemoveSizer.add(this.bbRemoveButton, 0);

    // Channels group
    this.channelsGroup = new GroupBox(this);
    this.channelsGroup.title = "Source Views";
    this.channelsGroup.sizer = new VerticalSizer;
    this.channelsGroup.sizer.margin  = 6;
    this.channelsGroup.sizer.spacing = 4;
    this.channelsGroup.sizer.add(this.nbStarSizer);
    this.channelsGroup.sizer.add(this.bbPickerSizer);
    this.channelsGroup.sizer.add(this.bbListBox);
    this.channelsGroup.sizer.add(this.bbRemoveSizer);

    // Populate from any pre-loaded channels (process icon reload)
    this.refreshBBList();

    // ------------------------------------------------------------------
    // Generate Starless
    // ------------------------------------------------------------------
    this.starXLabel = new Label(this);
    this.starXLabel.text          = "Method:";
    this.starXLabel.minWidth      = labelWidth1;
    this.starXLabel.maxWidth      = labelWidth1;
    this.starXLabel.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;

    this.starXComboBox = new ComboBox(this);
    this.starXComboBox.toolTip =
        "<p>Star removal method used to generate the starless composite broadband and " +
        "narrowband images. The composite is built automatically from the optimised " +
        "broadband weights before star removal is applied.</p>";
    this.starXComboBox.addItem("<None>");
    this.starXComboBox.addItem("StarXTerminator");
    this.starXComboBox.addItem("StarNet V2");
    this.starXComboBox.currentItem = ToolParameters.starRemovalMethod;
    this.starXComboBox.onItemSelected = function (indx) { ToolParameters.starRemovalMethod = indx; };

    this.starXSizer = new HorizontalSizer(this);
    this.starXSizer.margin  = 6;
    this.starXSizer.spacing = 4;
    this.starXSizer.add(this.starXLabel, 0);
    this.starXSizer.add(this.starXComboBox, 0);
    this.starXSizer.addStretch();

    this.starlessGroup = new GroupBox(this);
    this.starlessGroup.title        = "Generate Starless";
    this.starlessGroup.titleCheckBox= true;
    this.starlessGroup.checked      = ToolParameters.starlessEnabled;
    this.starlessGroup.toolTip      =
        "<p>After computing the optimised weights, the script builds a weighted composite " +
        "broadband image, runs the selected star removal tool on it and on the narrowband, " +
        "then performs the continuum subtraction on the starless pair.</p>";
    this.starlessGroup.onCheck = function () { ToolParameters.starlessEnabled = this.checked; };
    this.starlessGroup.sizer = new VerticalSizer;
    this.starlessGroup.sizer.margin  = 6;
    this.starlessGroup.sizer.spacing = 4;
    this.starlessGroup.sizer.add(this.starXSizer);

    // ------------------------------------------------------------------
    // Settings group
    // ------------------------------------------------------------------
    this.maxStarsLabel = new Label(this);
    this.maxStarsLabel.text          = "Maximum Stars: ";
    this.maxStarsLabel.minWidth      = labelWidth2;
    this.maxStarsLabel.maxWidth      = labelWidth2;
    this.maxStarsLabel.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;

    this.maxStars = new NumericControl(this);
    this.maxStars.toolTip = "<p>Maximum number of stars included in the flux calculation. Higher values are slower but may be more accurate.</p><p>Default: 400</p>";
    this.maxStars.setPrecision(0); this.maxStars.setRange(50, 1000);
    this.maxStars.setReal(false);  this.maxStars.slider.setRange(0, 19);
    this.maxStars.setValue(ToolParameters.maxStars);
    this.maxStars.onValueUpdated = function (value) { ToolParameters.maxStars = value; };

    this.maxStarsSizer = new HorizontalSizer(this);
    this.maxStarsSizer.margin = 6;
    this.maxStarsSizer.add(this.maxStarsLabel, 1);
    this.maxStarsSizer.add(this.maxStars, 0);

    this.maxPeakLabel = new Label(this);
    this.maxPeakLabel.text          = "Maximum Peak: ";
    this.maxPeakLabel.minWidth      = labelWidth2;
    this.maxPeakLabel.maxWidth      = labelWidth2;
    this.maxPeakLabel.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;

    this.maxPeak = new NumericControl(this);
    this.maxPeak.toolTip = "<p>Maximum peak pixel value for a star to be included. Lower values exclude saturated stars.</p><p>Default: 0.8</p>";
    this.maxPeak.setPrecision(2); this.maxPeak.setRange(0, 1);
    this.maxPeak.setReal(true);   this.maxPeak.slider.setRange(0, 10);
    this.maxPeak.setValue(ToolParameters.maxPeak);
    this.maxPeak.onValueUpdated = function (value) { ToolParameters.maxPeak = value; };

    this.maxPeakSizer = new HorizontalSizer(this);
    this.maxPeakSizer.margin = 6;
    this.maxPeakSizer.add(this.maxPeakLabel, 1);
    this.maxPeakSizer.add(this.maxPeak, 0);

    this.generatePlotLabel = new Label(this);
    this.generatePlotLabel.text          = "Generate Plot: ";
    this.generatePlotLabel.minWidth      = labelWidth2;
    this.generatePlotLabel.maxWidth      = labelWidth2;
    this.generatePlotLabel.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;
    this.generatePlotLabel.toolTip = "<p>Plot composite broadband vs. narrowband flux with robust trendline and inlier/outlier colouring.</p>";

    this.generatePlotCheckBox = new CheckBox(this);
    this.generatePlotCheckBox.toolTip = this.generatePlotLabel.toolTip;
    this.generatePlotCheckBox.checked = ToolParameters.generatePlot;
    this.generatePlotCheckBox.onCheck = function () { ToolParameters.generatePlot = this.checked; };

    this.generatePlotSizer = new HorizontalSizer(this);
    this.generatePlotSizer.margin = 6;
    this.generatePlotSizer.add(this.generatePlotLabel, 1);
    this.generatePlotSizer.addSpacing(10);
    this.generatePlotSizer.add(this.generatePlotCheckBox, 0);

    this.keepCompositeLabel = new Label(this);
    this.keepCompositeLabel.text          = "Keep Composite: ";
    this.keepCompositeLabel.minWidth      = labelWidth2;
    this.keepCompositeLabel.maxWidth      = labelWidth2;
    this.keepCompositeLabel.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;
    this.keepCompositeLabel.toolTip = "<p>Keep and show the weighted composite broadband image after processing. " +
        "The composite is scaled by the regression factor k so its stellar flux matches the narrowband image. " +
        "This is useful if you want to apply a different or unsupported star removal process to either image. " +
        "It is named <i>composite_bb_&lt;nb&gt;</i>.</p>" + 
        "<p>This can be subtracted from the nb image in PixelMath using " +
        "<i>&lt;nb&gt; - (composite - med(composite))</i></p>";

    this.keepCompositeCheckBox = new CheckBox(this);
    this.keepCompositeCheckBox.toolTip = this.keepCompositeLabel.toolTip;
    this.keepCompositeCheckBox.checked = ToolParameters.keepComposite;
    this.keepCompositeCheckBox.onCheck = function () { ToolParameters.keepComposite = this.checked; };

    this.keepCompositeSizer = new HorizontalSizer(this);
    this.keepCompositeSizer.margin = 6;
    this.keepCompositeSizer.add(this.keepCompositeLabel, 1);
    this.keepCompositeSizer.addSpacing(10);
    this.keepCompositeSizer.add(this.keepCompositeCheckBox, 0);

    this.settingsGroup = new GroupBox(this);
    this.settingsGroup.title = "Settings";
    this.settingsGroup.sizer = new VerticalSizer;
    this.settingsGroup.sizer.add(this.maxStarsSizer);
    this.settingsGroup.sizer.add(this.maxPeakSizer);
    this.settingsGroup.sizer.add(this.generatePlotSizer);
    this.settingsGroup.sizer.add(this.keepCompositeSizer);

    // ------------------------------------------------------------------
    // Bottom buttons
    // ------------------------------------------------------------------
    this.newInstanceButton = new ToolButton(this);
    this.newInstanceButton.icon = this.scaledResource(":/process-interface/new-instance.png");
    this.newInstanceButton.setScaledFixedSize(20, 20);
    this.newInstanceButton.toolTip = "New Instance";
    this.newInstanceButton.onMousePress = function () {
        this.hasFocus = true; ToolParameters.save();
        this.pushed = false; this.dialog.newInstance();
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
        if (ToolParameters.nbStarView == null || ToolParameters.nbStarView == undefined) {
            console.warningln("Warning: Narrowband image is not defined. Define narrowband images to execute");
            console.show(); return;
        }
        if (ToolParameters.bbChannels.length === 0) {
            console.warningln("Warning: No broadband channels defined. Define broadband images to execute.");
            console.show(); return;
        }
        this.dialog.ok(); 
    };

    this.cancel_Button = new PushButton(this);
    this.cancel_Button.text = "Cancel";
    this.cancel_Button.icon = this.scaledResource(":/icons/cancel.png");
    this.cancel_Button.onClick = function () { this.dialog.cancel(); };

    this.buttons_Sizer = new HorizontalSizer;
    this.buttons_Sizer.scaledSpacing = 6;
    this.buttons_Sizer.add(this.newInstanceButton);
    this.buttons_Sizer.add(this.docs_Button);
    this.buttons_Sizer.addStretch();
    this.buttons_Sizer.add(this.ok_Button);
    this.buttons_Sizer.add(this.cancel_Button);

    // ------------------------------------------------------------------
    // Global sizer
    // ------------------------------------------------------------------
    this.sizer = new VerticalSizer(this);
    this.sizer.margin  = 6;
    this.sizer.spacing = 4;
    this.sizer.add(this.label);
    this.sizer.addSpacing(4);
    this.sizer.add(this.channelsGroup);
    this.sizer.addSpacing(4);
    this.sizer.add(this.starlessGroup);
    this.sizer.addSpacing(4);
    this.sizer.add(this.settingsGroup);
    this.sizer.addStretch();
    this.sizer.add(this.buttons_Sizer);
}
}; // end MainDialog

function showDialog() {
    let dialog = new MainDialog;
    return dialog.execute();
}

function main() {
    let retVal = 0;
    if (Parameters.isViewTarget) {
        console.show(); ToolParameters.load(); retVal = 1;
    } else if (Parameters.isGlobalTarget) {
        ToolParameters.load(); retVal = showDialog();
    } else {
        retVal = showDialog();
    }
    if (retVal == 1) continuumSubtract();
}

main();