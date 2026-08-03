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


class PaymentRequired(ServiceError):
    """The account's subscription is expired/suspended, or a plan usage limit is
    reached — the action needs an upgrade or renewal, not just different input.
    Routers translate this to HTTP 402 so the frontend can show a dedicated
    "upgrade your plan" UI instead of a generic error."""
