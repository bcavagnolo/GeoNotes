# This class contains configuration variables that are used by settings.py but
# may differ from developer to developer and from deployment to deployment.

import os
class DEPLOY_SETTINGS:
    password = '******' # the database password
    content_root = os.getcwd() # root directory for templates/, public/, etc.
