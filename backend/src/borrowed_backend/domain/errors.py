from .models import Feasibility


class NotFound(Exception):
    pass


class Conflict(Exception):
    def __init__(self, feasibility: Feasibility):
        self.feasibility = feasibility
        super().__init__(feasibility.reason)


class IdempotencyConflict(Exception):
    pass


class PersistenceFailure(Exception):
    pass
