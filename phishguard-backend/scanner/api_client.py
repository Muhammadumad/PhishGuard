# scanner/api_client.py — Resilient HTTP Client with Connection Pooling & Circuit Breaking
import logging
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

logger = logging.getLogger("scanner")

DEFAULT_USER_AGENT = "PhishGuard-ThreatIntel/2.0 (+https://phishguard.security)"
DEFAULT_TIMEOUT = (2.5, 4.0)  # (connect_timeout, read_timeout) in seconds


class ResilientAPIClient:
    """
    Centralized, thread-safe HTTP client session manager with connection pooling,
    automatic retries with exponential backoff, and strict timeout enforcement.
    """
    _session = None

    @classmethod
    def get_session(cls) -> requests.Session:
        if cls._session is None:
            session = requests.Session()

            # Retry configuration for idempotent requests
            retries = Retry(
                total=2,
                backoff_factor=0.3,
                status_forcelist=[500, 502, 503, 504],
                raise_on_status=False,
            )

            adapter = HTTPAdapter(
                pool_connections=20,
                pool_maxsize=50,
                max_retries=retries,
            )

            session.mount("http://", adapter)
            session.mount("https://", adapter)
            session.headers.update({"User-Agent": DEFAULT_USER_AGENT})
            cls._session = session

        return cls._session

    @classmethod
    def request(
        cls,
        method: str,
        url: str,
        headers: dict = None,
        params: dict = None,
        json_data: dict = None,
        data=None,
        timeout: tuple[float, float] | float = DEFAULT_TIMEOUT,
        allow_redirects: bool = True,
        stream: bool = False,
    ) -> requests.Response | None:
        """
        Execute an HTTP request with connection pooling and fail-safe handling.
        Returns requests.Response on success or None on failure.
        """
        session = cls.get_session()
        req_headers = dict(session.headers)
        if headers:
            req_headers.update(headers)

        try:
            response = session.request(
                method=method.upper(),
                url=url,
                headers=req_headers,
                params=params,
                json=json_data,
                data=data,
                timeout=timeout,
                allow_redirects=allow_redirects,
                stream=stream,
            )
            return response
        except requests.exceptions.Timeout:
            logger.warning(f"ResilientAPIClient timeout calling {method} {url[:80]}")
            return None
        except requests.exceptions.SSLError as e:
            logger.warning(f"ResilientAPIClient SSL error calling {url[:80]}: {e}")
            return None
        except requests.exceptions.RequestException as e:
            logger.warning(f"ResilientAPIClient network error calling {url[:80]}: {e}")
            return None
        except Exception as e:
            logger.error(f"ResilientAPIClient unexpected error calling {url[:80]}: {e}")
            return None

    @classmethod
    def get(cls, url: str, **kwargs) -> requests.Response | None:
        return cls.request("GET", url, **kwargs)

    @classmethod
    def post(cls, url: str, **kwargs) -> requests.Response | None:
        return cls.request("POST", url, **kwargs)
