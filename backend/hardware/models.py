from django.db import models

class Category(models.Model):
    key = models.SlugField(primary_key=True)
    label = models.CharField(max_length=100)
    icon = models.CharField(max_length=50)
    short = models.CharField(max_length=20)
    filterable = models.BooleanField(default=False)
    multi_select = models.BooleanField(default=False)

    def __str__(self):
        return self.label

    class Meta:
        verbose_name_plural = "Categories"

class Component(models.Model):
    id = models.CharField(max_length=100, primary_key=True)
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='components')
    name = models.CharField(max_length=255)
    # Store all other attributes as JSON for flexibility in SQLite
    specs = models.JSONField(default=dict)

    def __str__(self):
        return self.name
