from sqlalchemy import update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models import ProjectCounter


def next_ticket_number(db: Session, project_key: str) -> int:
    """Réserve le numéro suivant pour un projet, dans la transaction en cours.

    L'UPDATE verrouille la ligne du compteur jusqu'à la fin de la transaction :
    deux créations simultanées attendent leur tour et ne reçoivent jamais le même
    numéro. Si la transaction est annulée, le numéro n'est pas consommé.
    """
    db.execute(
        insert(ProjectCounter)
        .values(key=project_key, last_number=0)
        .on_conflict_do_nothing(index_elements=["key"])
    )
    return db.execute(
        update(ProjectCounter)
        .where(ProjectCounter.key == project_key)
        .values(last_number=ProjectCounter.last_number + 1)
        .returning(ProjectCounter.last_number)
    ).scalar_one()
