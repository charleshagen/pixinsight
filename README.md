# Scripts List #
1. **ApplySTF** | ``NightPhotons > ApplySTF``
2. **PhotometricContinuumSubtraction** | ``NightPhotons > PhotometricContinuumSubtraction``

## Update procedure: ##
1. zip src directory
   - ``updates/nightphotons-YYYY-MM-DD.zip``
2. update.xri
   - Change file name to new .zip
   - Generate SHA1: ``certutil -hashfile .\updates\nightphotons-DATE.zip SHA1``
   - Change update description and title
   - Change release date
