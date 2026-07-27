from rest_framework.test import APIRequestFactory, force_authenticate
from django.contrib.auth import get_user_model
from scanner.views import ScanView

User = get_user_model()

u, created = User.objects.get_or_create(email='smoke@example.com', defaults={'username': 'smokeuser'})
if created:
    u.set_password('Sup3rStrongP@ss!')
    u.save()

factory = APIRequestFactory()
req = factory.post('/api/scan/', {'url': 'example.com'}, format='json')
# attach authentication
force_authenticate(req, user=u)
resp = ScanView.as_view()(req)
print('status:', getattr(resp, 'status_code', None))
try:
    print('data:', resp.data)
except Exception:
    print('content:', getattr(resp, 'content', None))
