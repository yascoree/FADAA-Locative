"""Domain exceptions raised by service-layer functions.

Service functions never import FastAPI or raise ``HTTPException``.
Instead they raise one of these typed exceptions, which the API routers catch
and translate into the appropriate HTTP status codes.
"""


class ServiceError(Exception):
    """Base class for all service-layer domain errors."""


class NotFound(ServiceError):
    """The requested resource does not exist (or is soft-deleted)."""


class Forbidden(ServiceError):
    """The caller does not have the right to perform this action."""


class BadRequest(ServiceError):
    """The caller supplied invalid or inconsistent data."""
