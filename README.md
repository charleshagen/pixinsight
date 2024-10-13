# NightPhotons Processing Suite #
A repository of scripts and utilites to improve and expand upon the pixinsight processing flow.

## Scripts List ##
1. **ApplySTF** | ``NightPhotons > ApplySTF``
2. **PhotometricContinuumSubtraction** | ``NightPhotons > PhotometricContinuumSubtraction``

## Installation ##
`https://raw.githubusercontent.com/charleshagen/pixinsight/main/updates/`
- Add this to your pixnsight repo list under Resources > Updates > Manage Repositories
- Check for updates, Resources > Updates > Check for Updates
- Apply changes and restart Pixinsight

## Developer Update Procedure: ##
1. zip ``src`` and ``rsc`` directory
   - ``updates/nightphotons-YYYY-MM-DD.zip``
2. update.xri
   - Change file name to new .zip
   - Generate SHA1: ``certutil -hashfile .\updates\nightphotons-DATE.zip SHA1``
   - Change update description and title
   - Change release date
