from django.contrib.gis.db import models
from django.contrib.auth.models import User

class Layer(models.Model):
    # A layer has an owner
    owner = models.ForeignKey(User)
    name = models.CharField(max_length=50)

    def __unicode__(self):
        return self.owner.username + ": " + self.name

class GeoNote(models.Model):
    layer = models.ForeignKey(Layer)
    note = models.TextField()
    point = models.PointField()
    objects = models.GeoManager()

    def __unicode__(self):
        return layer.__unicode__() + ": " + self.note[0:min(20,len(self.note))]
