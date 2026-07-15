import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { UserSummary } from '../lib/types'

interface LikersModalProps {
  title: string
  // API path returning UserSummary[], e.g. /posts/:id/likes 
  fetchPath: string
  onClose: () => void
}

export function LikersModal({ title, fetchPath, onClose }: LikersModalProps) {
  const [likers, setLikers] = useState<UserSummary[] | null>(null)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    let isMounted = true
    api
      .get<UserSummary[]>(fetchPath)
      .then((users) => {
        if (isMounted) setLikers(users)
      })
      .catch(() => {
        if (isMounted) setHasError(true)
      })
    return () => {
      isMounted = false
    }
  }, [fetchPath])

  return (
    <div className="bs-modal-backdrop" onClick={onClose}>
      <div className="bs-modal" onClick={(event) => event.stopPropagation()}>
        <div className="bs-modal-head">
          <h4>{title}</h4>
          <button type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {hasError && <p className="bs-feed-status">Could not load likes.</p>}
        {!hasError && likers === null && <p className="bs-feed-status">Loading...</p>}
        {likers !== null && likers.length === 0 && (
          <p className="bs-feed-status">No likes yet.</p>
        )}
        {likers?.map((liker) => (
          <div key={liker.id} className="bs-modal-row">
            <img src="/assets/images/comment_img.png" alt="" />
            <span>
              {liker.firstName} {liker.lastName}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
