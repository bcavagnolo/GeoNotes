from django.contrib.gis.db import models
from django.contrib.auth.models import User
from django.utils.translation import ugettext_lazy as _

# NB: For some reason, django creates all of the tables for these models with
# quoted names.  So if you use psql to inspect them, be sure to quote the table
# names.
class Layer(models.Model):
    # A layer has an owner
    owner = models.ForeignKey(User, related_name='_layer_set')
    name = models.CharField(_("name"), max_length=50)

    def __unicode__(self):
        return self.owner.username + ": " + self.name

class GeoNote(models.Model):
    layer = models.ForeignKey(Layer)
    note = models.TextField()
    point = models.PointField()
    objects = models.GeoManager()

    def __unicode__(self):
        return layer.__unicode__() + ": " + self.note[0:min(20,len(self.note))]
