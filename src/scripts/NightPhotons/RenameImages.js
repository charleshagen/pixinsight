
#include <pjsr/StdButton.jsh>
#include <pjsr/StdIcon.jsh>
#include <pjsr/Sizer.jsh>
#include <pjsr/NumericControl.jsh>

#feature-id    RenameImages : NightPhotons > RenameImages
#feature-icon  @script_icons_dir/RenameImages.svg
#feature-info  Automatically closes or renames images according to the output of a pattern and regular expression

#define TITLE "RenameImages"
#define VERSION "1.1.1"

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
               let id = this.generateValidID(content);
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
      if (View.viewById(id).isNull) {
         return id;
      }
      while (!View.viewById(newID).isNull) {
         iteration += 1;
         newID = id + iteration;
      }
      return newID;
   }
}

var engine = new RenameImagesEngine;

function MainDialog() {
   this.__base__ = Dialog;
   this.__base__();
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
   with (this.label) {
      wordWrapping = true;
      useRichText = true;
      margin = 4;
      text = "<b>" + TITLE + " v" + VERSION + "</b> | Charles Hagen"
         + "<p>Execute this script after opening files to rename or close all open views with identifiers matching the provided regular expressions and patterns. "
         + "Be careful to test the regex first, as all image closures are final and irreversible. Default expressions should work in most cases for WBPP / FBPP "
         + "to close autogenerated maps and rename master lights to their filter name.</p>"
         + "<p><i>Create a process icon and apply directly to any image to run without opening the dialog.</i></p>";
   }

   // --------------------------------------------------------------
   // Rename Group
   // --------------------------------------------------------------

   // Mode 
   this.renameMode_Label = new Label(this);
   with (this.renameMode_Label) {
      text = "Mode: "; 
      minWidth = labelWidth;
      maxWidth = labelWidth;
      textAlignment = TextAlign_Right|TextAlign_VertCenter;
   }

   this.renameMode_ComboBox = new ComboBox(this);
   with(this.renameMode_ComboBox) {
      maxWidth = this.font.width("Image identifier") + 10;
      toolTip = "<p> Images with no filepath will be skipped with Filepath or Filename mode selected. </p><p> PixInsight 1.9.3 brings breaking changes to WBPP/FBPP outputs, requiring the use of one of the file modes instead of identifier mode to access data previously available in the identifier. </p>";
      addItem("Identifier");
      addItem("Filepath");
      addItem("Filename");
      currentItem = findItem(ToolParameters.renameMode);
      onItemSelected = function (item) {
         ToolParameters.renameMode = itemText(item);
      }
   }


   this.renameMode_Sizer = new HorizontalSizer;
   with (this.renameMode_Sizer) {
      margin = 6;
      add(this.renameMode_Label);
      add(this.renameMode_ComboBox);
      addStretch();
   }

   // Regex
   this.renameRegex_Label = new Label(this);
   with (this.renameRegex_Label) {
      text = "Regex: ";
      minWidth = labelWidth;
      maxWidth = labelWidth;
      textAlignment = TextAlign_Right|TextAlign_VertCenter;
   }

   this.renameRegex_Edit = new Edit(this);
   with (this.renameRegex_Edit) {
      margin = 4;
      text = ToolParameters.renameString;
      toolTip = "<p> Define the regex to select and rename images. Do not wrap the string in slashes, they are implicit. </p>";
      onTextUpdated = function () {
         ToolParameters.renameString = text;
      }
   }

   this.renameRegex_Sizer = new HorizontalSizer;
   with (this.renameRegex_Sizer) {
      margin = 6;
      add(this.renameRegex_Label);
      add(this.renameRegex_Edit);
   }

   // Pattern
   this.renamePattern_Label = new Label(this);
   with (this.renamePattern_Label) {
      text = "Pattern: "
      minWidth = labelWidth;
      maxWidth = labelWidth;
      textAlignment = TextAlign_Right|TextAlign_VertCenter;
   }

   this.renamePattern_Edit = new Edit(this);
   with (this.renamePattern_Edit) {
      margin = 4;
      text = ToolParameters.renamePatternString;
      toolTip = "<p> Define the naming pattern. Use curly braces with index values, eg. {0} or {1} to select regex groups, and dollar signs, eg $FILTER$ to select FITS Header values. Additionally, add formatting flags before the closing symbol to format the inner text. eg. {0-u}, $FILTER-p$ See docs for more details. </p>";
      onTextUpdated = function () {
         ToolParameters.renamePatternString = text;
      }
   }

   this.renamePattern_Sizer = new HorizontalSizer;
   with (this.renamePattern_Sizer) {
      margin = 6;
      add(this.renamePattern_Label);
      add(this.renamePattern_Edit);
   }

   // Flags
   this.renameFlags_Label = new Label(this);
   with (this.renameFlags_Label) {
      text = "Flags: "
      minWidth = labelWidth;
      maxWidth = labelWidth;
      textAlignment = TextAlign_Right|TextAlign_VertCenter;
   }

   // Case Insensitive
   this.renameCaseInsensitive_CheckBox = new CheckBox(this);
   with (this.renameCaseInsensitive_CheckBox) {
       toolTip = "<p>Use the regex case insensitive flag, \"i\"</p>";
       checked = ToolParameters.renameCaseInsensitive;
       text = "Case Insensitive";
       onCheck = function () {
           ToolParameters.renameCaseInsensitive = checked;
       }
   }

   // Flags sizer
   this.renameFlags_Sizer = new HorizontalSizer;
   with (this.renameFlags_Sizer) {
      margin = 6;
      add(this.renameFlags_Label);
      add(this.renameCaseInsensitive_CheckBox);
      addStretch();
   }

   // Group
   this.renameGroup = new GroupBox(this);
   with (this.renameGroup) {
       title = "Rename Images";
       sizer = new VerticalSizer;
       toolTip = "<p> Rename all open views with identifiers matching the provided regex. By default, it will rename standard WBPP and FBPP output to the filter name. All captured groups are joined with underscores to form the new identifier. </p>";
       titleCheckBox = true;
       checked = ToolParameters.renameEnabled;
       onCheck = function () {
           ToolParameters.renameEnabled = checked;
       }
   }
   with (this.renameGroup.sizer) {
      margin = 2;
      add(this.renameMode_Sizer);
      add(this.renameRegex_Sizer);
      add(this.renamePattern_Sizer);
      add(this.renameFlags_Sizer);
   }

   // --------------------------------------------------------------
   // Close Images Group
   // --------------------------------------------------------------

   // Regex
   this.closeRegex_Label = new Label(this);
   with (this.closeRegex_Label) {
      text = "Regex: "
      minWidth = labelWidth;
      maxWidth = labelWidth;
      textAlignment = TextAlign_Right|TextAlign_VertCenter;
   }

   this.closeRegex_Edit = new Edit(this);
   with (this.closeRegex_Edit) {
      margin = 4;
      text = ToolParameters.closeString;
      toolTip = "<p> Define the regex to select and close images. Do not wrap the string in slashes, they are implicit. </p>";
      onTextUpdated = function () {
         ToolParameters.closeString = text;
      }
   }

   this.closeRegex_Sizer = new HorizontalSizer;
   with (this.closeRegex_Sizer) {
      margin = 6;
      add(this.closeRegex_Label);
      add(this.closeRegex_Edit);
   }

   // Flags
   this.closeFlags_Label = new Label(this);
   with (this.closeFlags_Label) {
      text = "Flags: "
      minWidth = labelWidth;
      maxWidth = labelWidth;
      textAlignment = TextAlign_Right|TextAlign_VertCenter;
   }

   // Case Insensitive
   this.closeCaseInsensitive_CheckBox = new CheckBox(this);
   with (this.closeCaseInsensitive_CheckBox) {
       toolTip = "<p>Use the regex case insensitive flag, \"i\"</p>";
       checked = ToolParameters.closeCaseInsensitive;
       text = "Case Insensitive";
       onCheck = function () {
           ToolParameters.closeCaseInsensitive = checked;
       }
   }

   // Flags sizer
   this.closeFlags_Sizer = new HorizontalSizer;
   with (this.closeFlags_Sizer) {
      margin = 6;
      add(this.closeFlags_Label);
      add(this.closeCaseInsensitive_CheckBox);
      addStretch();
   }

   // Group
   this.closeGroup = new GroupBox(this);
   with (this.closeGroup) {
       title = "Close Images";
       sizer = new VerticalSizer;
       toolTip = "<p> Use the defined regex to close matching images. By default, images with identifiers containing \"rejection\", \"slope\", \"weightImage\", and \"crop_mask\" will be closed. This will close maps autogenerated by WBPP and FBPP.</p>"
       titleCheckBox = true;
       checked = ToolParameters.closeEnabled;
       onCheck = function () {
           ToolParameters.closeEnabled = checked;
       }
   }

   with (this.closeGroup.sizer) {
      margin = 2;
      add(this.closeRegex_Sizer);
      add(this.closeFlags_Sizer);
   }

   // --------------------------------------------------------------
   // Settings Images Group
   // --------------------------------------------------------------

   // Group
   this.settingsGroup = new GroupBox(this);
   with (this.settingsGroup) {
       title = "Settings";
       sizer = new VerticalSizer;
   }

   // History
   this.settingsHistory_CheckBox = new CheckBox(this);
   with (this.settingsHistory_CheckBox) {
       toolTip = "<p>If this setting is enabled, images with process history, both past and future, can be renamed or closed. This setting is disabled by default for safety.</p>";
       checked = ToolParameters.settingsHistory;
       text = "Modify Images with History";
       onCheck = function () {
           ToolParameters.settingsHistory = checked;
       }
   }

   // Iconize
   this.settingsIconize_CheckBox = new CheckBox(this);
   with (this.settingsIconize_CheckBox) {
      toolTip = "<p>When an image is renamed, iconize the image.</p>";
      checked = ToolParameters.settingsIconize;
      text = "Iconize after Rename";
      onCheck = function () {
         ToolParameters.settingsIconize = checked;
      }
   }

   // Force Close
   this.settingsForceClose_CheckBox = new CheckBox(this);
   with (this.settingsForceClose_CheckBox) {
       toolTip = "<p>If this setting is enabled, images that are set to be closed will be closed without prompting the user. </p>";
       checked = ToolParameters.settingsForceClose;
       text = "Force close";
       onCheck = function () {
           ToolParameters.settingsForceClose = checked;
       }
   }

   with (this.settingsGroup.sizer) {
      margin = 8;
      add(this.settingsHistory_CheckBox);
      addSpacing(4);
      add(this.settingsIconize_CheckBox);
      addSpacing(4);
      add(this.settingsForceClose_CheckBox);
      addSpacing(4);
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

   this.docs_Button = new ToolButton(this);
   with (this.docs_Button) {
      text = "Docs";
      icon = this.scaledResource(":/process-explorer/browse-documentation.png");
      onClick = function () {
         Dialog.openBrowser("https://nightphotons.com/software/rename-images/");
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
      add(this.docs_Button);
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
      add(this.renameGroup)
      addSpacing(4);
      add(this.closeGroup)
      addSpacing(4);
      add(this.settingsGroup)
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
      engine.execute();
   }
}

main();
