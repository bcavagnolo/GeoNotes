from django.template import RequestContext
from django.shortcuts import render_to_response
from djangorestframework.views import View
from django.contrib.auth.models import User
from djangorestframework.response import Response, ErrorResponse
from djangorestframework import status, authentication
from django.contrib.gis.geos import GEOSGeometry
from models import *

# Dump exceptions to the server log
from django.core.signals import got_request_exception
import logging
def log_exception(*args, **kwds):
    logging.exception('Exception in request:')
got_request_exception.connect(log_exception)

def index(request):
    return render_to_response('GeoNotes/index.html',
                              context_instance=RequestContext(request))

class AuthView(View):
    """
    a View for model instances only accessible to the user that owns them
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

class UserView(AuthView):
    """
    A view that allows authenticated users to GET or DELETE their profile, and
    POST new layers.
    """

    def get(self, request, username=None):
        """
        GETting geonotes/users/foo/ returns a list of foo's layers
        """
        u = self._check_perm(request, username)
        try:
            layers = Layer.objects.filter(owner=u)
        except Layer.DoesNotExist:
            return;
        layers = map(lambda l: {"name": l.name,
                                "uri": request.build_absolute_uri(u.username + "/" + l.name),
                                },
                     layers)
        if layers == []:
            return
        return Response(status.HTTP_200_OK, layers)

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

    def post(self, request, username=None):
        """
        POSTing to a user's URL creates a new layer to contain geonotes.
        """
        u = self._check_perm(request, username)
        msg = "layer name is required"
        try:
            l = self.DATA['layer']
            if l == "":
                raise KeyError
            layer = Layer.objects.get(owner=u, name=l)
            if layer != None:
                return Response(status.HTTP_409_CONFLICT,
                                "a layer with that name already exists.")
        except Layer.DoesNotExist:
            pass
        except KeyError:
            return Response(status.HTTP_400_BAD_REQUEST, msg)

        # Okay.  The layer doesn't exist.  We're good to go.
        layer = Layer(owner=u, name=l)
        layer.save()
        headers = {}
        headers['Location'] = request.build_absolute_uri(layer.name)
        return Response(status.HTTP_201_CREATED, None, headers)

class LayerView(AuthView):
    """
    A view that allows authenticated users to POST new GeoNotes to a layer, GET
    a layer with links to all of its GeoNotes, and DELETE a layer.
    """

    def _get_layer_or_404(self, request, username=None, layername=None):
        u = self._check_perm(request, username)
        try:
            layer = Layer.objects.get(owner=u, name=layername)
        except Layer.DoesNotExist:
            raise ErrorResponse(status.HTTP_404_NOT_FOUND, None, {})
        return layer

    def delete(self, request, username=None, layername=None):
        layer = self._get_layer_or_404(request, username, layername)
        layer.delete()
        return

    def get(self, request, username=None, layername=None):
        layer = self._get_layer_or_404(request, username, layername)
        # TODO: return a list of geonotes (or links to geonotes)
        return Response(status.HTTP_200_OK)

    def post(self, request, username=None, layername=None):
        layer = self._get_layer_or_404(request, username, layername)
        n = ''
        lat = None
        lon = None
        try:
            n = self.DATA['note']
        except KeyError:
            pass
        try:
            lat = self.DATA['lat']
            lon = self.DATA['lon']
        except KeyError:
            return Response(status.HTTP_400_BAD_REQUEST, "lat and lon are both required")

        # Okay.  All the params are validated
        gnote = GeoNote(layer=layer, note=n, point='POINT(' + lon + ' ' + lat + ')')
        gnote.save()
        headers = {}
        headers['Location'] = request.build_absolute_uri(str(gnote.id))
        return Response(status.HTTP_201_CREATED, None, headers)

class GeoNoteView(AuthView):
    """
    A view that allows authenticated users to GET a GeoNote, PUT (update), and
    DELETE a geonote.
    """
    def _get_gnote_or_404(self, request, username, layername, id):
        u = self._check_perm(request, username)
        try:
            gnote = GeoNote.objects.get(id=id)
            return gnote
        except GeoNote.DoesNotExist:
            raise ErrorResponse(status.HTTP_404_NOT_FOUND, None, {})

    def delete(self, request, username=None, layername=None, id=None):
        gnote = self._get_gnote_or_404(request, username, layername, id)
        gnote.delete()
        return

    def get(self, request, username=None, layername=None, id=None):
        gnote = self._get_gnote_or_404(request, username, layername, id)
        return Response(status.HTTP_200_OK, {'point':gnote.point.json,
                                             'note':gnote.note})

    def put(self, request, username=None, layername=None, id=None):
        gnote = self._get_gnote_or_404(request, username, layername, id)
        n = ''
        lat = None
        lon = None
        try:
            if self.DATA == None:
                raise KeyError
            n = self.DATA['note']
            gnote.note = n
        except KeyError:
            pass
        try:
            if self.DATA == None:
                raise KeyError
            lat = self.DATA['lat']
            gnote.point.y = float(lat)
        except KeyError:
            pass
        try:
            if self.DATA == None:
                raise KeyError
            lon = self.DATA['lon']
            gnote.point.y = float(lon)
        except KeyError:
            pass
        gnote.save()
        return
