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
    A view that allows authenticated users to GET their profile.
    """
    def get(self, request, username=None):
        # get a user profile.  Here we enforce a bit of permission by only
        # allowing users to view their own profiles.  There is probably a
        # better way to do this by embracing either the contrib.auth or
        # djangorestframework permission systems.  But our immediate need is
        # for the client to have some non-destructive way of verifying that the
        # username and password are correct.
        auth = authentication.BasicAuthentication(self)
        u = auth.authenticate(request)
        if u == None or u.username != username:
            raise ErrorResponse(status.HTTP_403_FORBIDDEN, None, {})
        response = Response(200)
        return self.render(response)

    # TODO: This class needs a put routine that updates a users' profile
    # information
