export interface UserSummary {
  id: string
  firstName: string
  lastName: string
}

export interface CurrentUser extends UserSummary {
  email: string
}

export interface FeedPost {
  id: string
  content: string
  imageUrl: string | null
  privacy: 'PUBLIC' | 'PRIVATE'
  createdAt: string
  author: UserSummary
  likeCount: number
  likedByMe: boolean
  commentCount: number
}

export interface FeedPage {
  items: FeedPost[]
  nextCursor: string | null
}

export interface CommentView {
  id: string
  postId: string
  parentCommentId: string | null
  content: string
  createdAt: string
  author: UserSummary
  likeCount: number
  likedByMe: boolean
  replies: CommentView[]
}

export interface CommentPage {
  items: CommentView[]
  totalTopLevel: number
  hasMore: boolean
}
