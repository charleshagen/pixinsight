#include <pjsr/StdButton.jsh>
#include <pjsr/StdIcon.jsh>
#include <pjsr/Sizer.jsh>
#include <pjsr/NumericControl.jsh>

#feature-id    ApplySTF : NightPhotons > ApplySTF
#feature-icon  @script_icons_dir/ApplySTF.svg
#feature-info  This script is used to apply the active STF to the image

#define TITLE "ApplySTF"
#define VERSION "1.2.1"

var ToolParameters = {
   targetView: undefined,
   respectMask: false,
   save: function () {
      Parameters.set("RespectMask", ToolParameters.respectMask);
   },
   load: function () {
      if (Parameters.has("RespectMask")) {
         ToolParameters.respectMask = Parameters.getBoolean("RespectMask");
      }
   }
};

function ApplySTF() {
   var P = new HistogramTransformation;
   var HTArr = P.H;
   var STFArr = ToolParameters.targetView.stf;
   var isMaskEnabled = ToolParameters.targetView.window.maskEnabled;
   var isLinked = false;

   if (isMaskEnabled && !ToolParameters.respectMask) {
      console.warningln("Mask is enabled, temproarily disabling mask");
      ToolParameters.targetView.window.maskEnabled = false;
   }

   if (STFArr[0][1] == STFArr[1][1] && STFArr[1][1] == STFArr[2][1]
      && STFArr[0][2] == STFArr[1][2] && STFArr[1][2] == STFArr[2][2]
      && STFArr[0][3] == STFArr[1][3] && STFArr[1][3] == STFArr[2][3]) {
      isLinked = true;
   }

   // Transfer STF parameters to Histogram Transformation
   if (ToolParameters.targetView.image.isColor && !isLinked) {
      for (let i = 0; i < 3; i++) {
         console.writeln("Applying unlinked STF");
         HTArr[i][0] = STFArr[i][1];
         HTArr[i][1] = STFArr[i][0];
         HTArr[i][2] = STFArr[i][2];
         HTArr[i][3] = STFArr[i][3];
      }
   } else {
      console.writeln("Applying linked STF");
      HTArr[3][0] = STFArr[0][1];
      HTArr[3][1] = STFArr[0][0];
      HTArr[3][2] = STFArr[0][2];
      HTArr[3][3] = STFArr[0][3];
   }
   P.H = HTArr;
   P.executeOn(ToolParameters.targetView);

   // Reset STF parameters to off
   for (let i = 0; i < 4; i++) {
      STFArr[i] = [0.5, 0, 1, 0, 1];
   }
   ToolParameters.targetView.stf = STFArr;

   // Re-enable the mask if it was enabled earlier
   if (isMaskEnabled && !ToolParameters.respectMask) {
      ToolParameters.targetView.window.maskEnabled = true;
   }
}

function MainDialog() {
   this.__base__ = Dialog;
   this.__base__();
   var self = this;

   // MAIN DIALOG BODY

   // Window parameters
   this.windowTitle = TITLE;
   var panelWidth = this.font.width("<b>ApplySTF v" + VERSION + "</b> | Charles Hagen");
   this.minWidth = panelWidth;
   this.width = 300;

    // --------------------------------------------------------------
    // Description & Title
    // --------------------------------------------------------------
   this.label = new Label(this);
   with (this.label) {
      wordWrapping = true;
      useRichText = true;
      margin = 4;
      text = "<b>ApplySTF v" + VERSION + "</b> | Charles Hagen<br></br><br></br>"
         + "Execute to apply the currently active STF to the image permanently. "
         + "Create an instance icon to apply the script to any image without opening "
         + "the script dialog.";
   }

   // Target View List
   this.targetViewList = new ViewList(this);
   with (this.targetViewList) {
      getMainViews();
      onViewSelected = function (view) {
         ToolParameters.targetView = view;
      }
   }

   this.targetViewSetActiveButton = new ToolButton(this);
   with (this.targetViewSetActiveButton) {
      icon = this.scaledResource(":/icons/select-view.png");
      setScaledFixedSize(20, 20);
      toolTip = "Set active window as target";
      onClick = function () {
         ToolParameters.targetView = ImageWindow.activeWindow.currentView;
         self.targetViewList.currentView = ToolParameters.targetView;
      }
   }

   this.targetGroup = new GroupBox(this)
   with (this.targetGroup) {
      sizer = new HorizontalSizer(this);
      sizer.margin = 6;
      sizer.add(this.targetViewList);
      sizer.addSpacing(5);
      sizer.add(this.targetViewSetActiveButton);
      title = "Target View";
   }

    // --------------------------------------------------------------
    // Settings
    // --------------------------------------------------------------


   this.respectMaskCheckbox = new CheckBox(this);
   with (this.respectMaskCheckbox) {
      text = "Respect Mask"
      checked = ToolParameters.respectMask;
      toolTip = "<p>If a this setting is enabled, the script will respect any active mask on the image. If this setting is disabled, it will temporarily disable the mask when applying, then re-enable it after the script has completed.</p> <p>Default is disabled.</p>";
      onClick = function () {
         ToolParameters.respectMask = !ToolParameters.respectMask;
      }
   }

   this.settingsGroup = new GroupBox(this)
   with (this.settingsGroup) {
      sizer = new HorizontalSizer(this);
      sizer.margin = 6;
      sizer.add(this.respectMaskCheckbox);
      title = "Options";
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


   // GLOBAL SIZER
   this.sizer = new VerticalSizer(this);
   with (this.sizer) {
      margin = 6;
      spacing = 4;
      add(this.label);
      addSpacing(4);
      add(this.targetGroup);
      addSpacing(4);
      add(this.settingsGroup)
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
      ToolParameters.targetView = Parameters.targetView; //Parameters.targetView is the image being applied to
      retVal = 1; // Dialog is never shown
   } else if (Parameters.isGlobalTarget) {
      ToolParameters.load();// Load the parameters in global context
      retVal = showDialog();
   } else {
      retVal = showDialog();
   }

   if (retVal == 1) {
      ApplySTF();
   }
}

main();
