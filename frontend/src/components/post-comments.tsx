import type { KeyboardEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { formatShortTime } from '../lib/time'
import type { CommentPage, CommentView } from '../lib/types'
import { LikersModal } from './likers-modal'

const COMMENTS_PAGE_SIZE = 5

interface PostCommentsProps {
  postId: string
  commentCount: number
  // Bumps whenever the post's Comment reaction button is pressed. 
  focusSignal: number
  onCommentAdded: () => void
}


export function PostComments({
  postId,
  commentCount,
  focusSignal,
  onCommentAdded,
}: PostCommentsProps) {
  const [comments, setComments] = useState<CommentView[]>([])
  const [hasLoaded, setHasLoaded] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [remaining, setRemaining] = useState(0)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [likersFor, setLikersFor] = useState<string | null>(null)
  const commentBoxRef = useRef<HTMLTextAreaElement>(null)

  // Load the first page only when there is something to show.
  useEffect(() => {
    if (commentCount === 0 || hasLoaded) return
    let isMounted = true
    api
      .get<CommentPage>(`/posts/${postId}/comments?limit=${COMMENTS_PAGE_SIZE}`)
      .then((page) => {
        if (!isMounted) return
        setComments(page.items)
        setHasMore(page.hasMore)
        setRemaining(page.totalTopLevel - page.items.length)
        setHasLoaded(true)
      })
      .catch(() => {
      })
    return () => {
      isMounted = false
    }
  }, [postId, commentCount, hasLoaded])

  useEffect(() => {
    if (focusSignal > 0) commentBoxRef.current?.focus()
  }, [focusSignal])

  async function loadPrevious() {
    const page = await api.get<CommentPage>(
      `/posts/${postId}/comments?limit=${COMMENTS_PAGE_SIZE}&offset=${comments.length}`,
    )
    // Older comments belong above the ones already shown.
    setComments((current) => [...page.items, ...current])
    setHasMore(page.hasMore)
    setRemaining(page.totalTopLevel - comments.length - page.items.length)
  }

  async function submitComment(content: string, parentCommentId: string | null) {
    const created = await api.post<CommentView>(`/posts/${postId}/comments`, {
      content,
      ...(parentCommentId ? { parentCommentId } : {}),
    })

    if (parentCommentId) {
      setComments((current) =>
        current.map((comment) =>
          comment.id === parentCommentId
            ? { ...comment, replies: [...comment.replies, created] }
            : comment,
        ),
      )
      setReplyingTo(null)
    } else {
      // Newest comment sits at the bottom, right above the input.
      setComments((current) => [...current, created])
      setHasLoaded(true)
    }
    onCommentAdded()
  }

  function updateCommentInTree(updated: CommentView) {
    setComments((current) =>
      current.map((comment) => {
        if (comment.id === updated.id) return { ...updated, replies: comment.replies }
        if (comment.replies.some((reply) => reply.id === updated.id)) {
          return {
            ...comment,
            replies: comment.replies.map((reply) =>
              reply.id === updated.id ? updated : reply,
            ),
          }
        }
        return comment
      }),
    )
  }

  async function toggleLike(comment: CommentView) {
    // Optimistic flip, corrected by the server's authoritative count.
    updateCommentInTree({
      ...comment,
      likedByMe: !comment.likedByMe,
      likeCount: comment.likeCount + (comment.likedByMe ? -1 : 1),
    })
    try {
      const result = comment.likedByMe
        ? await api.delete<{ likeCount: number }>(`/comments/${comment.id}/like`)
        : await api.post<{ likeCount: number }>(`/comments/${comment.id}/like`)
      updateCommentInTree({
        ...comment,
        likedByMe: !comment.likedByMe,
        likeCount: result.likeCount,
      })
    } catch {
      updateCommentInTree(comment)
    }
  }

  function renderComment(comment: CommentView, isReply: boolean) {
    return (
      <div className="_comment_main" key={comment.id}>
        <div className="_comment_image">
          <a href="#0" className="_comment_image_link" onClick={(e) => e.preventDefault()}>
            <img src="/assets/images/txt_img.png" alt="" className="_comment_img1" />
          </a>
        </div>
        <div className="_comment_area">
          <div className="_comment_details">
            <div className="_comment_details_top">
              <div className="_comment_name">
                <a href="#0" onClick={(e) => e.preventDefault()}>
                  <h4 className="_comment_name_title">
                    {comment.author.firstName} {comment.author.lastName}
                  </h4>
                </a>
              </div>
            </div>
            <div className="_comment_status">
              <p className="_comment_status_text">
                <span>{comment.content}</span>
              </p>
            </div>
            {comment.likeCount > 0 && (
              <div className="_total_reactions">
                <div className="_total_react">
                  <span className="_reaction_like">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="feather feather-thumbs-up"
                    >
                      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
                    </svg>
                  </span>
                </div>
                <span className="_total">
                  <button
                    type="button"
                    className="bs-count-button"
                    onClick={() => setLikersFor(comment.id)}
                  >
                    {comment.likeCount}
                  </button>
                </span>
              </div>
            )}
            <div className="_comment_reply">
              <div className="_comment_reply_num">
                <ul className="_comment_reply_list">
                  <li className="bs-comment-action" onClick={() => void toggleLike(comment)}>
                    <span className={comment.likedByMe ? 'bs-like-active' : undefined}>
                      Like.
                    </span>
                  </li>
                  {!isReply && (
                    <li
                      className="bs-comment-action"
                      onClick={() =>
                        setReplyingTo((current) =>
                          current === comment.id ? null : comment.id,
                        )
                      }
                    >
                      <span>Reply.</span>
                    </li>
                  )}
                  <li>
                    <span className="_time_link">.{formatShortTime(comment.createdAt)}</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          {comment.replies.map((reply) => renderComment(reply, true))}
          {replyingTo === comment.id && (
            <CommentBox
              placeholder="Write a reply"
              autoFocus
              onSubmit={(content) => submitComment(content, comment.id)}
            />
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="_feed_inner_timeline_cooment_area">
        <div className="_feed_inner_comment_box">
          <CommentBox
            placeholder="Write a comment"
            textareaRef={commentBoxRef}
            onSubmit={(content) => submitComment(content, null)}
          />
        </div>
      </div>
      {(comments.length > 0 || hasMore) && (
        <div className="_timline_comment_main">
          {hasMore && (
            <div className="_previous_comment">
              <button
                type="button"
                className="_previous_comment_txt"
                onClick={() => void loadPrevious()}
              >
                View {remaining} previous comment{remaining === 1 ? '' : 's'}
              </button>
            </div>
          )}
          {comments.map((comment) => renderComment(comment, false))}
        </div>
      )}
      {likersFor && (
        <LikersModal
          title="Liked by"
          fetchPath={`/comments/${likersFor}/likes`}
          onClose={() => setLikersFor(null)}
        />
      )}
    </>
  )
}

interface CommentBoxProps {
  placeholder: string
  autoFocus?: boolean
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>
  onSubmit: (content: string) => Promise<void>
}


//  The design's comment input
//  Enter submits, Shift+Enter adds a newline — same as the real networks.

function CommentBox({ placeholder, autoFocus, textareaRef, onSubmit }: CommentBoxProps) {
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit() {
    const trimmed = content.trim()
    if (!trimmed || isSubmitting) return
    setIsSubmitting(true)
    try {
      await onSubmit(trimmed)
      setContent('')
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void handleSubmit()
    }
  }

  return (
    <form
      className="_feed_inner_comment_box_form"
      onSubmit={(event) => {
        event.preventDefault()
        void handleSubmit()
      }}
    >
      <div className="_feed_inner_comment_box_content">
        <div className="_feed_inner_comment_box_content_image">
          <img src="/assets/images/comment_img.png" alt="" className="_comment_img" />
        </div>
        <div className="_feed_inner_comment_box_content_txt">
          <textarea
            ref={textareaRef}
            className="form-control _comment_textarea"
            placeholder={placeholder}
            value={content}
            autoFocus={autoFocus}
            onChange={(event) => setContent(event.target.value)}
            onKeyDown={handleKeyDown}
          ></textarea>
        </div>
      </div>
      <div className="_feed_inner_comment_box_icon">
        <button type="button" className="_feed_inner_comment_box_icon_btn">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            fill="none"
            viewBox="0 0 16 16"
          >
            <path
              fill="#000"
              fillOpacity=".46"
              fillRule="evenodd"
              d="M13.167 6.534a.5.5 0 01.5.5c0 3.061-2.35 5.582-5.333 5.837V14.5a.5.5 0 01-1 0v-1.629C4.35 12.616 2 10.096 2 7.034a.5.5 0 011 0c0 2.679 2.168 4.859 4.833 4.859 2.666 0 4.834-2.18 4.834-4.86a.5.5 0 01.5-.5zM7.833.667a3.218 3.218 0 013.208 3.22v3.126c0 1.775-1.439 3.22-3.208 3.22a3.218 3.218 0 01-3.208-3.22V3.887c0-1.776 1.44-3.22 3.208-3.22zm0 1a2.217 2.217 0 00-2.208 2.22v3.126c0 1.223.991 2.22 2.208 2.22a2.217 2.217 0 002.208-2.22V3.887c0-1.224-.99-2.22-2.208-2.22z"
              clipRule="evenodd"
            />
          </svg>
        </button>
        <button type="button" className="_feed_inner_comment_box_icon_btn">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            fill="none"
            viewBox="0 0 16 16"
          >
            <path
              fill="#000"
              fillOpacity=".46"
              fillRule="evenodd"
              d="M10.867 1.333c2.257 0 3.774 1.581 3.774 3.933v5.435c0 2.352-1.517 3.932-3.774 3.932H5.101c-2.254 0-3.767-1.58-3.767-3.932V5.266c0-2.352 1.513-3.933 3.767-3.933h5.766zm0 1H5.101c-1.681 0-2.767 1.152-2.767 2.933v5.435c0 1.782 1.086 2.932 2.767 2.932h5.766c1.685 0 2.774-1.15 2.774-2.932V5.266c0-1.781-1.089-2.933-2.774-2.933zm.426 5.733l.017.015.013.013.009.008.037.037c.12.12.453.46 1.443 1.477a.5.5 0 11-.716.697S10.73 8.91 10.633 8.816a.614.614 0 00-.433-.118.622.622 0 00-.421.225c-1.55 1.88-1.568 1.897-1.594 1.922a1.456 1.456 0 01-2.057-.021s-.62-.63-.63-.642c-.155-.143-.43-.134-.594.04l-1.02 1.076a.498.498 0 01-.707.018.499.499 0 01-.018-.706l1.018-1.075c.54-.573 1.45-.6 2.025-.06l.639.647c.178.18.467.184.646.008l1.519-1.843a1.618 1.618 0 011.098-.584c.433-.038.854.088 1.19.363zM5.706 4.42c.921 0 1.67.75 1.67 1.67 0 .92-.75 1.67-1.67 1.67-.92 0-1.67-.75-1.67-1.67 0-.921.75-1.67 1.67-1.67zm0 1a.67.67 0 10.001 1.34.67.67 0 00-.002-1.34z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </form>
  )
}
