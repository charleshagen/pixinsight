#engine v8

#feature-id    ApplySTF : NightPhotons > ApplySTF
#feature-icon  @script_icons_dir/ApplySTF.svg
#feature-info  This script is used to apply the active STF to the image

CoreApplication.ensureMinimumVersion( 1, 9, 4 );

#define TITLE "ApplySTF"
#define VERSION "1.3.0"

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
   var isMaskEnabled = ToolParameters.targetView.window.maskEnabled && !ToolParameters.targetView.window.mask.isNull;
   var isLinked = false;
 
   if (isMaskEnabled && !ToolParameters.respectMask) {
      console.noteln("Mask is enabled, temproarily disabling mask");
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

var MainDialog = class extends Dialog {
constructor() {
   super();
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
   this.label.wordWrapping = true;
   this.label.useRichText = true;
   this.label.margin = 4;
   this.label.text = "<b>ApplySTF v" + VERSION + "</b> | Charles Hagen<br></br><br></br>"
      + "Execute to apply the currently active STF to the image permanently. "
      + "Create an instance icon to apply the script to any image without opening "
      + "the script dialog.";

   // Target View List
   this.targetViewList = new ViewList(this);
   this.targetViewList.getMainViews();
   this.targetViewList.onViewSelected = function (view) {
      ToolParameters.targetView = view;
   }


   this.targetViewSetActiveButton = new ToolButton(this);
   this.targetViewSetActiveButton.icon = this.scaledResource(":/icons/select-view.png");
   this.targetViewSetActiveButton.setScaledFixedSize(20, 20);
   this.targetViewSetActiveButton.toolTip = "Set active window as target";
   this.targetViewSetActiveButton.onClick = function () {
      ToolParameters.targetView = ImageWindow.activeWindow.currentView;
      self.targetViewList.currentView = ToolParameters.targetView;
   }

   this.targetGroup = new GroupBox(this)
   this.targetGroup.sizer = new HorizontalSizer(this);
   this.targetGroup.sizer.margin = 6;
   this.targetGroup.sizer.add(this.targetViewList);
   this.targetGroup.sizer.addSpacing(5);
   this.targetGroup.sizer.add(this.targetViewSetActiveButton);
   this.targetGroup.title = "Target View";

    // --------------------------------------------------------------
    // Settings
    // --------------------------------------------------------------


   this.respectMaskCheckbox = new CheckBox(this);
   this.respectMaskCheckbox.text = "Respect Mask"
   this.respectMaskCheckbox.checked = ToolParameters.respectMask;
   this.respectMaskCheckbox.toolTip = "<p>Respect any active mask on the image. If this setting is disabled, it will temporarily disable the mask when applying, then re-enable it after the script has completed.</p> <p>Default is disabled.</p>";
   this.respectMaskCheckbox.onClick = function () {
      ToolParameters.respectMask = !ToolParameters.respectMask;
   }

   this.settingsGroup = new GroupBox(this)
   this.settingsGroup.sizer = new HorizontalSizer(this);
   this.settingsGroup.sizer.margin = 6;
   this.settingsGroup.sizer.add(this.respectMaskCheckbox);
   this.settingsGroup.title = "Options";


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
      Dialog.openBrowser("https://nightphotons.com/software/apply-stf/");
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


   // GLOBAL SIZER
   this.sizer = new VerticalSizer(this);
   this.sizer.margin = 6;
   this.sizer.spacing = 4;
   this.sizer.add(this.label);
   this.sizer.addSpacing(4);
   this.sizer.add(this.targetGroup);
   this.sizer.addSpacing(4);
   this.sizer.add(this.settingsGroup)
   this.sizer.addSpacing(4);
   this.sizer.addStretch();
   this.sizer.add(this.buttons_Sizer);
}
};
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
