from django.template import RequestContext
from django.shortcuts import render_to_response
from djangorestframework.views import View
from django.contrib.auth.models import User
from djangorestframework.response import Response, ErrorResponse
from djangorestframework import status, authentication

def index(request):
    return render_to_response('GeoNotes/index.html',
                              context_instance=RequestContext(request))

class UsersView(View):
    """
    This view maps to geonotes/users/.  It provides the capability to create
    (POST) new users.  No other methods are exposed.
    """
    def post(self, request):
        # Check for required parameters
        try:
            username = self.DATA['username']
            password = self.DATA['password']
            if username == "" or password == "":
                raise KeyError
            u = User.objects.get(username=username)
            if u != None:
                return Response(status.HTTP_400_BAD_REQUEST, "That username already exists")
        except User.DoesNotExist:
            pass
        except KeyError:
            return Response(status.HTTP_400_BAD_REQUEST,
                            "username and password are required")

        user = User.objects.create_user(username, "", password)
        return Response(status.HTTP_201_CREATED)

class UserView(View):
    """
    A view that allows authenticated users to GET or DELETE their profile.
    """

    def _check_perm(self, request, username):
        # get a user profile.  Here we enforce a bit of permission by only
        # allowing users to operate on their own profiles.  There is probably a
        # better way to do this by embracing the contrib.auth and/or
        # djangorestframework permission systems.  Note that we return 403
        # instead of 404 if the user doesn't exist.  This is common practice to
        # prevent malicious users from knowing whether or not a particular
        # username exists.
        auth = authentication.BasicAuthentication(self)
        u = auth.authenticate(request)
        if u == None or u.username != username:
            raise ErrorResponse(status.HTTP_403_FORBIDDEN, None, {})
        return u

    def get(self, request, username=None):
        """
        GETting geonotes/users/foo/ just verifies that the credentials are
        valid.  No state is stored on the server side.
        """
        u = self._check_perm(request, username)
        return Response(status.HTTP_200_OK)

    def delete(self, request, username=None):
        """
        DELETEing geonotes/users/foo/ deletes a users.  At this time, the other
        resources that get deleted are unspecified.
        """
        u = self._check_perm(request, username)
        u.delete()
        return

    def put(self, request, username=None):
        # TODO: At this time, we only support password updates.  But we should
        # just update any key/value pairs that the user sends.  Hmm.
        u = self._check_perm(request, username)
        try:
            password = self.DATA['password']
            if password == "":
                raise KeyError
            u.set_password(password)
            u.save()
        except KeyError:
            return Response(status.HTTP_400_BAD_REQUEST,
                            "password is required")
        return
