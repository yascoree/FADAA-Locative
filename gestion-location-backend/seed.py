from app.database import SessionLocal
from app.models.subscription_plan import SubscriptionPlan, SubscriptionTarget
from app.models.agence import Agence
from app.models.subscription import Subscription, SubscriptionStatus
from datetime import datetime, timedelta

db = SessionLocal()

# 1. Create Trial Agence plan if it doesn't exist
plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.target_type == SubscriptionTarget.AGENCE, SubscriptionPlan.is_trial == True).first()
if not plan:
    plan = SubscriptionPlan(
        name='Trial Agence',
        description="Abonnement d'essai pour les agences",
        price=0,
        duration_days=14,
        is_trial=True,
        color='navy',
        target_type=SubscriptionTarget.AGENCE,
        max_biens=10,
        max_lots=30,
        max_baux_actifs=30,
        max_membres_agence=3,
        max_locataires=50,
        max_quittances_mois=50,
        max_storage_mb=500,
        can_export=False
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    print('Created Trial Agence plan')

# 2. Assign to all agencies without a subscription
agences = db.query(Agence).all()
count = 0
for a in agences:
    sub = db.query(Subscription).filter(Subscription.agence_id == a.id).first()
    if not sub:
        now = datetime.utcnow()
        new_sub = Subscription(
            agence_id=a.id,
            plan_id=plan.id,
            status=SubscriptionStatus.ACTIF,
            trial_start=now,
            trial_end=now + timedelta(days=plan.duration_days),
            start_date=now,
            end_date=now + timedelta(days=plan.duration_days)
        )
        db.add(new_sub)
        count += 1

db.commit()
print(f'Assigned Trial Agence subscription to {count} agencies')
