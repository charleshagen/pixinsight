#engine v8

#feature-id    RenameImages : NightPhotons > RenameImages
#feature-icon  @script_icons_dir/RenameImages.svg
#feature-info  Automatically closes or renames images according to the output of a pattern and regular expression

CoreApplication.ensureMinimumVersion( 1, 9, 4 );

#define TITLE "RenameImages"
#define VERSION "1.2.0"

var ToolParameters = {
   renameMode: "Filename",
   renameString: ".*integration|masterLight.*filter[_-]([a-zA-Z0-9]*).*",
   renamePatternString: "$FILTER$",
   renameEnabled: true,
   renameCaseInsensitive: true,
   settingsIconize: false,
   closeString: ".*rejection|slope|weightimage|crop_mask.*",
   closeEnabled: true,
   closeCaseInsensitive: true,
   settingsHistory: false,
   settingsForceClose: true,
   save: function () {
      Parameters.set("RenameMode", ToolParameters.renameMode);
      Parameters.set("RenameString", ToolParameters.renameString);
      Parameters.set("RenamePatternString", ToolParameters.renamePatternString);
      Parameters.set("RenameEnabled", ToolParameters.renameEnabled);
      Parameters.set("RenameCaseInsensitive", ToolParameters.renameCaseInsensitive);
      Parameters.set("CloseString", ToolParameters.closeString);
      Parameters.set("CloseEnabled", ToolParameters.closeEnabled);
      Parameters.set("CloseCaseInsensitive", ToolParameters.closeCaseInsensitive);
      Parameters.set("SettingsHistory", ToolParameters.settingsHistory);
      Parameters.set("SettingsIconize", ToolParameters.settingsIconize);
      Parameters.set("SettingsForceClose", ToolParameters.settingsForceClose);
    },
   load: function () {
      if (Parameters.has("RenameMode")) {
         ToolParameters.renameMode = Parameters.getString("RenameMode");
      }
      if (Parameters.has("RenameString")) {
         ToolParameters.renameString = Parameters.getString("RenameString");
      }
      if (Parameters.has("RenamePatternString")) {
         ToolParameters.renamePatternString = Parameters.getString("RenamePatternString");
      }
      if (Parameters.has("RenameEnabled")) {
         ToolParameters.renameEnabled = Parameters.getBoolean("RenameEnabled");
      }
      if (Parameters.has("RenameCaseInsensitive")) {
         ToolParameters.renameCaseInsensitive = Parameters.getBoolean("RenameCaseInsensitive");
      }
      if (Parameters.has("CloseString")) {
         ToolParameters.closeString = Parameters.getString("CloseString");
      }
      if (Parameters.has("CloseEnabled")) {
         ToolParameters.closeEnabled = Parameters.getBoolean("CloseEnabled");
      }
      if (Parameters.has("CloseCaseInsensitive")) {
         ToolParameters.closeCaseInsensitive = Parameters.getBoolean("CloseCaseInsensitive");
      }
      if (Parameters.has("SettingsHistory")) {
         ToolParameters.settingsHistory = Parameters.getBoolean("SettingsHistory");
      }
      if (Parameters.has("SettingsIconize")) {
         ToolParameters.settingsIconize = Parameters.getBoolean("SettingsIconize");
      }
      if (Parameters.has("SettingsForceClose")) {
         ToolParameters.settingsForceClose = Parameters.getBoolean("SettingsForceClose");
      }
   }
};

function RenameImagesEngine() {
   this.execute = function () {
      let windows = ImageWindow.windows;

      const rename = new RegExp(ToolParameters.renameString, ToolParameters.renameCaseInsensitive ? "i" : "");
      const close = new RegExp(ToolParameters.closeString, ToolParameters.closeCaseInsensitive ? "i" : "");
      let numRenamed = 0;
      let numClosed = 0;
      let numErrors = 0;
      let numSkipped = 0;

      for (let i = 0; i < windows.length; i++) {
         let window = windows[i];
         let view = window.mainView;

         var closeString = view.id;
         var renameString = view.id;

         if (!ToolParameters.settingsHistory) {
            if (view.canGoForward || view.canGoBackward) {
               numSkipped += 1;
               continue;
            }
         }

         const closeMatch = closeString.match(close);
         if (ToolParameters.closeEnabled && closeMatch) {
            console.noteln("Closing view: \"" + view.id + "\"");
            if (ToolParameters.settingsForceClose) {
               view.window.forceClose();
            } else {
               view.window.close();
            }
            numClosed += 1;
            continue;
         }

         switch(ToolParameters.renameMode) {
            case "Identifier":
               renameString = view.id;
               break;
            case "Filepath":
               if (window.filePath == "") {
                  numSkipped += 1;
                  continue;
               } else {
                  renameString = window.filePath;
               }
               console.criticalln(renameString);
               break;
            case "Filename":
               if (window.filePath == "") {
                  numSkipped += 1;
                  continue;
               } else {
                  var filenameRegex = /[\/\\]([^\\\/]+)\./;
                  var match = window.filePath.match(filenameRegex);
                  if (match) {
                     renameString = match[1];
                  } else {
                     console.warningln("Error selecting filename");
                     numSkipped += 1;
                     continue;
                  }
               }
               break;
            default:
               console.criticalln("Error: Invalid rename mode. Canceling operation.");
               return;
         }

         const renameMatch = renameString.match(rename);
         if (ToolParameters.renameEnabled && renameMatch) {
            let completeRename = true;
            if (renameMatch.length < 1) {
               console.warningln("Cannot rename image. Regular expression matched with no group on view: " + view.id);
               numErrors += 1;
               continue;
            }

            let content = ToolParameters.renamePatternString.replace(/\{(\d+)(\-[a-zA-Z]+)?\}/g, (_, i, f) => {
               const index = parseInt(i);
               const value = index >= 0 && index < renameMatch.length ? renameMatch[index].toString() : '';
               if (value.length == 0) {
                  console.warningln("ERROR | Could not rename image (" + view.id + ") | Pattern contains invalid group index: " + index);
                  completeRename = false;
               }
               switch(f) {
                  case undefined:
                  case "":
                     return value;
                  case "-u":
                     return value.toUpperCase();
                  case "-l":
                     return value.toLowerCase();
                  case "-p":
                     return value.toLowerCase().replace(/(^\w|[ _]\w)/g, (_, letter) => {
                        return letter.toUpperCase();
                     });
                  default:
                     console.warningln("ERROR | Could not rename image (" + view.id + ") | Pattern contains unrecognized flag: " + f);
                     completeRename = false;
                     return value;
               }
            });

            content = content.replace(/\$([a-zA-Z]+)(\-[a-zA-Z]+)?\$/g, (_, n, f) => {
               const name = n.toUpperCase();
               const keywords = window.keywords;
               for (let j = 0; j < keywords.length; j++) {
                  const fits = keywords[j];
                  if (fits.name.toUpperCase() == name) {
                     const value = fits.strippedValue;
                     if (value.length == 0) {
                        console.warningln("ERROR | Could not rename image (" + view.id + ") | Pattern contains invalid FITS keyword \"" + name + "\"");
                        completeRename = false;
                        return "";
                     }
                     switch(f) {
                        case undefined:
                        case "":
                           return value;
                        case "-u":
                           return value.toUpperCase();
                        case "-l":
                           return value.toLowerCase();
                        case "-p":
                           return value.toLowerCase().replace(/(^\w|[ _]\w)/g, (_, letter) => {
                              return letter.toUpperCase();
                           });
                        default:
                           console.warningln("ERROR | Could not rename image (" + view.id + ") | Pattern contains unrecognized flag: " + f);
                           completeRename = false;
                           return value;
                     }
                  }
               }
               console.warningln("ERROR | Could not rename image (" + view.id + ") | Failed to find FITS Keyword \"" + name + "\"");
               completeRename = false;
               return "";
            });

            if (completeRename) {
               let id;
               if (view.id == content) {
                  id = content;
               } else {
                  id = this.generateValidID(content)
               }
               console.noteln("Renaming view \"" + view.id + "\" to \"" + id + "\"");
               view.id = id;
               numRenamed += 1;
            } else {
               numErrors += 1;
            }
            // Deiconize the image and reiconize it to present the changed identifier if iconic
            if (window.iconic) {
               window.deiconize();
               window.iconize();
            } else if (ToolParameters.settingsIconize) {
               window.iconize();
            }
         }
      }

      console.noteln("================================================================");
      console.noteln("Process completed | " + numRenamed + " renamed | " + numClosed + " closed | " + numSkipped + " skipped | " + numErrors + " error" + (numErrors != 1 ? "s" : ""));
   };

   this.generateValidID = function (id) {
      if(id.length == 0) {
         return this.generateValidID("Image");
      }
      id = id.replace(/[^\w]+/g,"_");
      if (id[0] >= '0' && id[0] <= '9') {
         id = "_" + id;
      }
      let iteration = 1;
      let newID = id + iteration;
      if (View.viewById(id) == null) {
         return id;
      }
      while (!View.viewById(newID) == null) {
         iteration += 1;
         newID = id + iteration;
      }
      return newID;
   }
}

var engine = new RenameImagesEngine;

var MainDialog = class extends Dialog {
constructor() {
    super();
   var self = this;

   var labelWidth = this.font.width("Pattern: ");

   // MAIN DIALOG BODY

   // Window parameters
   this.windowTitle = TITLE;
   var panelWidth = this.font.width("<b>" + TITLE + "v" + VERSION + "</b> | Charles Hagen");
   this.minWidth = panelWidth;
   this.width = 400;

   // --------------------------------------------------------------
   // Description & Title
   // --------------------------------------------------------------
   this.label = new Label(this);
   this.label.wordWrapping = true;
   this.label.useRichText = true;
   this.label.margin = 4;
   this.label.text = "<b>" + TITLE + " v" + VERSION + "</b> | Charles Hagen"
      + "<p>Execute this script after opening files to rename or close all open views with identifiers matching the provided regular expressions and patterns. "
      + "Be careful to test the regex first, as all image closures are final and irreversible. Default expressions should work in most cases for WBPP / FBPP "
      + "to close autogenerated maps and rename master lights to their filter name.</p>"
      + "<p><i>Create a process icon and apply directly to any image to run without opening the dialog.</i></p>";

   // --------------------------------------------------------------
   // Rename Group
   // --------------------------------------------------------------

   // Mode
   this.renameMode_Label = new Label(this);
   this.renameMode_Label.text = "Mode: ";
   this.renameMode_Label.minWidth = labelWidth;
   this.renameMode_Label.maxWidth = labelWidth;
   this.renameMode_Label.textAlignment = TextAlignment.Right|TextAlignment.VertCenter;


   this.renameMode_ComboBox = new ComboBox(this);
   this.renameMode_ComboBox.maxWidth = this.font.width("Image identifier") + 10;
   this.renameMode_ComboBox.toolTip = "<p> Images with no filepath will be skipped with Filepath or Filename mode selected. </p><p> PixInsight 1.9.3 brings breaking changes to WBPP/FBPP outputs, requiring the use of one of the file modes instead of identifier mode to access data previously available in the identifier. </p>";
   this.renameMode_ComboBox.addItem("Identifier");
   this.renameMode_ComboBox.addItem("Filepath");
   this.renameMode_ComboBox.addItem("Filename");
   this.renameMode_ComboBox.currentItem = this.renameMode_ComboBox.findItem(ToolParameters.renameMode);
   this.renameMode_ComboBox.onItemSelected = function (item) {
      ToolParameters.renameMode = this.itemText(item);
   }


   this.renameMode_Sizer = new HorizontalSizer;
   this.renameMode_Sizer.margin = 6;
   this.renameMode_Sizer.add(this.renameMode_Label);
   this.renameMode_Sizer.add(this.renameMode_ComboBox);
   this.renameMode_Sizer.addStretch();


   // Regex
   this.renameRegex_Label = new Label(this);
   this.renameRegex_Label.text = "Regex: ";
   this.renameRegex_Label.minWidth = labelWidth;
   this.renameRegex_Label.maxWidth = labelWidth;
   this.renameRegex_Label.textAlignment = TextAlignment.Right|TextAlignment.VertCenter;

   this.renameRegex_Edit = new Edit(this);
   this.renameRegex_Edit.margin = 4;
   this.renameRegex_Edit.text = ToolParameters.renameString;
   this.renameRegex_Edit.toolTip = "<p> Define the regex to select and rename images. Do not wrap the string in slashes, they are implicit. </p>";
   this.renameRegex_Edit.onTextUpdated = function () {
      ToolParameters.renameString = this.text;
   }

   this.renameRegex_Sizer = new HorizontalSizer;
   this.renameRegex_Sizer.margin = 6;
   this.renameRegex_Sizer.add(this.renameRegex_Label);
   this.renameRegex_Sizer.add(this.renameRegex_Edit);

   // Pattern
   this.renamePattern_Label = new Label(this);
   this.renamePattern_Label.text = "Pattern: "
   this.renamePattern_Label.minWidth = labelWidth;
   this.renamePattern_Label.maxWidth = labelWidth;
   this.renamePattern_Label.textAlignment = TextAlignment.Right|TextAlignment.VertCenter;

   this.renamePattern_Edit = new Edit(this);
   this.renamePattern_Edit.margin = 4;
   this.renamePattern_Edit.text = ToolParameters.renamePatternString;
   this.renamePattern_Edit.toolTip = "<p> Define the naming pattern. Use curly braces with index values, eg. {0} or {1} to select regex groups, and dollar signs, eg $FILTER$ to select FITS Header values. Additionally, add formatting flags before the closing symbol to format the inner text. eg. {0-u}, $FILTER-p$ See docs for more details. </p>";
   this.renamePattern_Edit.onTextUpdated = function () {
      ToolParameters.renamePatternString = this.text;
   }

   this.renamePattern_Sizer = new HorizontalSizer;
   this.renamePattern_Sizer.margin = 6;
   this.renamePattern_Sizer.add(this.renamePattern_Label);
   this.renamePattern_Sizer.add(this.renamePattern_Edit);

   // Flags
   this.renameFlags_Label = new Label(this);
   this.renameFlags_Label.text = "Flags: "
   this.renameFlags_Label.minWidth = labelWidth;
   this.renameFlags_Label.maxWidth = labelWidth;
   this.renameFlags_Label.textAlignment = TextAlignment.Right|TextAlignment.VertCenter;


   // Case Insensitive
   this.renameCaseInsensitive_CheckBox = new CheckBox(this);
   this.renameCaseInsensitive_CheckBox.toolTip = "<p>Use the regex case insensitive flag, \"i\"</p>";
   this.renameCaseInsensitive_CheckBox.checked = ToolParameters.renameCaseInsensitive;
   this.renameCaseInsensitive_CheckBox.text = "Case Insensitive";
   this.renameCaseInsensitive_CheckBox.onCheck = function () {
      ToolParameters.renameCaseInsensitive = this.checked;
   }

   // Flags sizer
   this.renameFlags_Sizer = new HorizontalSizer;
   this.renameFlags_Sizer.margin = 6;
   this.renameFlags_Sizer.add(this.renameFlags_Label);
   this.renameFlags_Sizer.add(this.renameCaseInsensitive_CheckBox);
   this.renameFlags_Sizer.addStretch();

   // Group
   this.renameGroup = new GroupBox(this);
   this.renameGroup.title = "Rename Images";
   this.renameGroup.sizer = new VerticalSizer;
   this.renameGroup.toolTip = "<p> Rename all open views with identifiers matching the provided regex. By default, it will rename standard WBPP and FBPP output to the filter name. All captured groups are joined with underscores to form the new identifier. </p>";
   this.renameGroup.titleCheckBox = true;
   this.renameGroup.checked = ToolParameters.renameEnabled;
   this.renameGroup.onCheck = function () {
      ToolParameters.renameEnabled = this.checked;
   }

   this.renameGroup.sizer.margin = 2;
   this.renameGroup.sizer.add(this.renameMode_Sizer);
   this.renameGroup.sizer.add(this.renameRegex_Sizer);
   this.renameGroup.sizer.add(this.renamePattern_Sizer);
   this.renameGroup.sizer.add(this.renameFlags_Sizer);

   // --------------------------------------------------------------
   // Close Images Group
   // --------------------------------------------------------------

   // Regex
   this.closeRegex_Label = new Label(this);
   this.closeRegex_Label.text = "Regex: "
   this.closeRegex_Label.minWidth = labelWidth;
   this.closeRegex_Label.maxWidth = labelWidth;
   this.closeRegex_Label.textAlignment = TextAlignment.Right|TextAlignment.VertCenter;

   this.closeRegex_Edit = new Edit(this);
   this.closeRegex_Edit.margin = 4;
   this.closeRegex_Edit.text = ToolParameters.closeString;
   this.closeRegex_Edit.toolTip = "<p> Define the regex to select and close images. Do not wrap the string in slashes, they are implicit. </p>";
   this.closeRegex_Edit.onTextUpdated = function () {
      ToolParameters.closeString = this.text;
   }

   this.closeRegex_Sizer = new HorizontalSizer;
   this.closeRegex_Sizer.margin = 6;
   this.closeRegex_Sizer.add(this.closeRegex_Label);
   this.closeRegex_Sizer.add(this.closeRegex_Edit);

   // Flags
   this.closeFlags_Label = new Label(this);
   this.closeFlags_Label.text = "Flags: "
   this.closeFlags_Label.minWidth = labelWidth;
   this.closeFlags_Label.maxWidth = labelWidth;
   this.closeFlags_Label.textAlignment = TextAlignment.Right|TextAlignment.VertCenter;

   // Case Insensitive
   this.closeCaseInsensitive_CheckBox = new CheckBox(this);
   this.closeCaseInsensitive_CheckBox.toolTip = "<p>Use the regex case insensitive flag, \"i\"</p>";
   this.closeCaseInsensitive_CheckBox.checked = ToolParameters.closeCaseInsensitive;
   this.closeCaseInsensitive_CheckBox.text = "Case Insensitive";
   this.closeCaseInsensitive_CheckBox.onCheck = function () {
      ToolParameters.closeCaseInsensitive = this.checked;
   }

   // Flags sizer
   this.closeFlags_Sizer = new HorizontalSizer;
   this.closeFlags_Sizer.margin = 6;
   this.closeFlags_Sizer.add(this.closeFlags_Label);
   this.closeFlags_Sizer.add(this.closeCaseInsensitive_CheckBox);
   this.closeFlags_Sizer.addStretch();

   // Group
   this.closeGroup = new GroupBox(this);
   this.closeGroup.title = "Close Images";
   this.closeGroup.sizer = new VerticalSizer;
   this.closeGroup.toolTip = "<p> Use the defined regex to close matching images. By default, images with identifiers containing \"rejection\", \"slope\", \"weightImage\", and \"crop_mask\" will be closed. This will close maps autogenerated by WBPP and FBPP.</p>"
   this.closeGroup.titleCheckBox = true;
   this.closeGroup.checked = ToolParameters.closeEnabled;
   this.closeGroup.onCheck = function () {
      ToolParameters.closeEnabled = this.checked;
   }

   this.closeGroup.sizer.margin = 2;
   this.closeGroup.sizer.add(this.closeRegex_Sizer);
   this.closeGroup.sizer.add(this.closeFlags_Sizer);

   // --------------------------------------------------------------
   // Settings Images Group
   // --------------------------------------------------------------

   // Group
   this.settingsGroup = new GroupBox(this);
   this.settingsGroup.title = "Settings";
   this.settingsGroup.sizer = new VerticalSizer;

   // History
   this.settingsHistory_CheckBox = new CheckBox(this);
   this.settingsHistory_CheckBox.toolTip = "<p>If this setting is enabled, images with process history, both past and future, can be renamed or closed. This setting is disabled by default for safety.</p>";
   this.settingsHistory_CheckBox.checked = ToolParameters.settingsHistory;
   this.settingsHistory_CheckBox.text = "Modify Images with History";
   this.settingsHistory_CheckBox.onCheck = function () {
      ToolParameters.settingsHistory = this.checked;
   }

   // Iconize
   this.settingsIconize_CheckBox = new CheckBox(this);
   this.settingsIconize_CheckBox.toolTip = "<p>When an image is renamed, iconize the image.</p>";
   this.settingsIconize_CheckBox.checked = ToolParameters.settingsIconize;
   this.settingsIconize_CheckBox.text = "Iconize after Rename";
   this.settingsIconize_CheckBox.onCheck = function () {
      ToolParameters.settingsIconize = this.checked;
   }

      // Force Close
   this.settingsForceClose_CheckBox = new CheckBox(this);
   this.settingsForceClose_CheckBox.toolTip = "<p>If this setting is enabled, images that are set to be closed will be closed without prompting the user. </p>";
   this.settingsForceClose_CheckBox.checked = ToolParameters.settingsForceClose;
   this.settingsForceClose_CheckBox.text = "Force close";
   this.settingsForceClose_CheckBox.onCheck = function () {
      ToolParameters.settingsForceClose = this.checked;
   }

   this.settingsGroup.sizer.margin = 8;
   this.settingsGroup.sizer.add(this.settingsHistory_CheckBox);
   this.settingsGroup.sizer.addSpacing(4);
   this.settingsGroup.sizer.add(this.settingsIconize_CheckBox);
   this.settingsGroup.sizer.addSpacing(4);
   this.settingsGroup.sizer.add(this.settingsForceClose_CheckBox);
   this.settingsGroup.sizer.addSpacing(4);

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
      Dialog.openBrowser("https://nightphotons.com/software/rename-images/");
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
   this.sizer.add(this.renameGroup)
   this.sizer.addSpacing(4);
   this.sizer.add(this.closeGroup)
   this.sizer.addSpacing(4);
   this.sizer.add(this.settingsGroup)
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
      engine.execute();
   }
}

main();
