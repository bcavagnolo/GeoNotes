from django.conf.urls.defaults import patterns, include, url
from views import *

# Uncomment the next two lines to enable the admin:
# from django.contrib import admin
# admin.autodiscover()

urlpatterns = patterns('',
    url(r'^users[/]*$', UsersView.as_view()),
    url(r'^users/(?P<username>[^/]+)[/]*$', UserView.as_view(), name='user'),
    url(r'^users/(?P<username>[^/]+)/(?P<layername>[^/]+)[/]*$', LayerView.as_view(), name='layer'),

    # Examples:
    # url(r'^$', 'GeoNotes.views.home', name='home'),
    # url(r'^GeoNotes/', include('GeoNotes.foo.urls')),

    # Uncomment the admin/doc line below to enable admin documentation:
    # url(r'^admin/doc/', include('django.contrib.admindocs.urls')),

    # Uncomment the next line to enable the admin:
    # url(r'^admin/', include(admin.site.urls)),
)
