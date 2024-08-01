/*
     js/script.js
*/

let isLoggedIn = false;

window.handleImageError = function(img) {
    console.error('Failed to load image:', img.src);
    img.src = '/images/default-avatar.jpg';
    console.log('Fallback image set');
};
document.addEventListener('DOMContentLoaded', function() {
    isLoggedIn = document.body.dataset.userLoggedIn === 'true';
    
    initializeImageErrorHandling();
    initializeVoting();
    initializeBookmarking();
    initializeTagClickHandlers();

    // Initialize comments functionality if comments list exists
    if (document.querySelector('.comments-list')) {
        initializeComments();
    }

    // Initialize navigation bar
    initializeNavigation();

    // Initialize tags for user settings if the container exists
    if (document.getElementById('user-tags-container')) {
        initializeUserTags();
    }

    // Initialize CKEditor for About Me if the element exists
    if (document.getElementById('about-me')) {
        initializeAboutMeEditor();
    }

    initializeCommentActions();
    
});

function initializeImageErrorHandling() {
    document.querySelectorAll('img.avatar').forEach(img => {
        img.onerror = function() {
            handleImageError(this);
        };
    });
}

function initializeCreatePostPage() {
    let editor;

    ClassicEditor
        .create(document.querySelector('#editor'), {
            // CKEditor configuration
        })
        .then(newEditor => {
            editor = newEditor;
        })
        .catch(error => {
            console.error('CKEditor initialization error:', error);
        });

    // Handle form submission
    document.getElementById('post-form').addEventListener('submit', function(e) {
        e.preventDefault();
        console.log('Form submitted');
        
        const title = document.getElementById('post-title').value;
        const content = editor.getData(); // Get data from CKEditor
        const tagArray = Array.from(tags);
        
        const data = {
            title: title,
            content: content,
            tags: tagArray
        };
        
        fetch('/create-post', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        })
        .then(response => {
            console.log('Response status:', response.status);
            return response.json().then(data => ({status: response.status, body: data}));
        })
        .then(({status, body}) => {
            console.log('Response body:', body);
            if (status !== 200) {
                throw new Error(body.error || 'An error occurred');
            }
            // Redirect to the new post page
            window.location.href = '/post/' + body._id;
        })
        .catch((error) => {
            console.error('Error:', error);
            document.getElementById('error-message').textContent = 'Error: ' + (error.message || 'An unknown error occurred. Please try again.');
        });
    });
}

function initializeComments() {
    const commentsList = document.querySelector('.comments-list');

    commentsList.addEventListener('click', function(e) {
        // Dropdown toggle
        if (e.target.closest('.comment-menu')) {
            const menuContent = e.target.closest('.comment-menu').nextElementSibling;
            
            // Close all other open menus
            document.querySelectorAll('.comment-menu-content').forEach(menu => {
                if (menu !== menuContent) {
                    menu.style.display = 'none';
                }
            });

            // Toggle the clicked menu
            menuContent.style.display = menuContent.style.display === 'block' ? 'none' : 'block';
            e.stopPropagation(); // Prevent this click from immediately closing the menu
        }

        // Reply button functionality
        if (e.target.closest('.btn-reply')) {
            if (!isLoggedIn) {
                alert('Please log in to reply.');
                return;
            }
            const comment = e.target.closest('.comment');
            const existingForm = comment.querySelector('.reply-form');
            
            if (existingForm) {
                existingForm.remove();
            } else {
                const replyForm = createReplyForm();
                comment.appendChild(replyForm);
                replyForm.querySelector('textarea').focus();
            }
        }
    });

    // Close menus and reply forms when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.comment-actions')) {
            document.querySelectorAll('.comment-menu-content').forEach(menu => {
                menu.style.display = 'none';
            });
        }

        if (!e.target.closest('.reply-form') && !e.target.closest('.btn-reply')) {
            document.querySelectorAll('.reply-form').forEach(form => {
                form.remove();
            });
        }
    });

    // Add comment functionality
    const commentForm = document.querySelector('.comment-form-container');
    const commentInput = commentForm.querySelector('.comment-input');
    const addCommentBtn = commentForm.querySelector('.btn-add-comment');

    addCommentBtn.addEventListener('click', function() {
        if (!isLoggedIn) {
            alert('Please log in to comment.');
            return;
        }
        const commentText = commentInput.value.trim();
        if (commentText) {
            addComment(commentText);
            commentInput.value = '';
        }
    });

    function addComment(text, parentComment = null) {
        const newComment = document.createElement('div');
        newComment.className = 'comment' + (parentComment ? ' nested' : '');
        newComment.innerHTML = `
            <div class="comment-header">
                <div class="comment-user-info">
                    <img src="https://via.placeholder.com/30" alt="Current User" class="avatar small">
                    <span class="username">Current User</span>
                    <span class="time">Just now</span>
                </div>
                <div class="comment-actions">
                    <button class="comment-menu"><span class="material-icons">more_vert</span></button>
                    <div class="comment-menu-content">
                        <a href="#" class="edit-comment">Edit</a>
                        <a href="#" class="share-comment">Share</a>
                        <a href="#" class="bookmark-comment">Bookmark</a>
                    </div>
                </div>
            </div>
            <div class="comment-content">${text}</div>
            <button class="btn-reply">
                <span class="material-icons">reply</span>
                Reply
            </button>
        `;
        
        if (parentComment) {
            let nestedComments = parentComment.querySelector('.nested-comments');
            if (!nestedComments) {
                nestedComments = document.createElement('div');
                nestedComments.className = 'nested-comments';
                parentComment.appendChild(nestedComments);
            }
            nestedComments.appendChild(newComment);
        } else {
            commentsList.insertBefore(newComment, commentsList.firstChild);
        }
    }

    function createReplyForm() {
        const form = document.createElement('div');
        form.className = 'reply-form';
        form.innerHTML = `
            <textarea placeholder="Write a reply..." class="comment-input"></textarea>
            <button type="submit" class="btn-icon btn-add-comment"><span class="material-icons">send</span></button>
        `;

        const textarea = form.querySelector('textarea');
        const submitButton = form.querySelector('button');

        submitButton.addEventListener('click', function() {
            const replyText = textarea.value.trim();
            if (replyText) {
                const parentComment = form.closest('.comment');
                addComment(replyText, parentComment);
                form.remove();
            }
        });

        return form;
    }
}

function initializeNavigation() {
    const sidebarLinks = document.querySelectorAll('.left-column nav ul li a');
    
    sidebarLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            sidebarLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
        });
    });
    
    const currentPath = window.location.pathname;
    sidebarLinks.forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        }
    });
}

function initializeUserTags() {
    const tagInput = document.getElementById('user-tags');
    const tagsContainer = document.getElementById('user-tags-container');
    const tags = new Set(Array.from(tagsContainer.querySelectorAll('.tag')).map(tag => tag.dataset.tag));

    tagInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const tag = this.value.trim();
            if (tag && !tags.has(tag)) {
                addTag(tag);
                this.value = '';
            }
        }
    });

    tagsContainer.addEventListener('click', function(e) {
        if (e.target.classList.contains('remove-tag')) {
            const tagElement = e.target.closest('.tag');
            const tag = tagElement.dataset.tag;
            tags.delete(tag);
            tagElement.remove();
        }
    });

    function addTag(tag) {
        tags.add(tag);
        const tagElement = document.createElement('span');
        tagElement.classList.add('tag');
        tagElement.innerHTML = `${tag} <span class="material-icons">close</span>`;
        tagElement.querySelector('.material-icons').addEventListener('click', function() {
            tags.delete(tag);
            tagElement.remove();
        });
        tagsContainer.appendChild(tagElement);
    }

    // Update form submission to include tags
    document.querySelector('.settings-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = new FormData(this);
        formData.append('tags', JSON.stringify(Array.from(tags)));

        // Here you would typically send this data to your server
        fetch('/api/update-profile', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            // Handle success (e.g., show a success message)
            console.log('Profile updated successfully', data);
        })
        .catch(error => console.error('Error:', error));
    });
}

function initializeAboutMeEditor() {
    ClassicEditor
        .create(document.getElementById('about-me'), {
            toolbar: ['heading', '|', 'bold', 'italic', 'link', 'bulletedList', 'numberedList', 'blockQuote'],
            placeholder: 'Tell us about yourself...'
        })
        .catch(error => {
            console.error(error);
        });
}

function initializeVoting() {
    document.addEventListener('click', function(e) {
        const voteButton = e.target.closest('.upvote-btn, .downvote-btn');
        if (!voteButton) return;

        if (!isLoggedIn) {
            alert('Please log in to vote.');
            return;
        }

        const postId = voteButton.dataset.postId;
        const voteType = voteButton.classList.contains('upvote-btn') ? 'upvote' : 'downvote';

        handleVote(voteButton, postId, voteType);
    });
}

function handleVote(button, postId, voteType) {
    fetch(`/post/${postId}/${voteType}`, { method: 'POST' })
        .then(response => {
            if (response.status === 401) {
                alert('Please log in to vote.');
                throw new Error('Not authenticated');
            }
            return response.json();
        })
        .then(data => {
            updateVoteUI(button, data);
        })
        .catch(error => console.error('Error:', error));
}

function updateVoteUI(clickedButton, data) {
    const post = clickedButton.closest('.post, .full-post');
    const upvoteBtn = post.querySelector('.upvote-btn');
    const downvoteBtn = post.querySelector('.downvote-btn');
    const upvoteCount = post.querySelector('.upvote-count');

    if (upvoteCount) upvoteCount.textContent = data.upvotes;

    upvoteBtn.classList.toggle('active', data.userVote === 'upvote');
    downvoteBtn.classList.toggle('active', data.userVote === 'downvote');

    // Update the voteScore
    post.dataset.voteScore = data.upvotes - data.downvotes;
}

function initializeBookmarking() {
    document.addEventListener('click', function(e) {
        const bookmarkBtn = e.target.closest('.bookmark-btn');
        if (!bookmarkBtn) return;

        if (!isLoggedIn) {
            alert('Please log in to bookmark posts.');
            return;
        }

        const postId = bookmarkBtn.dataset.postId;
        handleBookmark(bookmarkBtn, postId);
    });
}

function handleBookmark(button, postId) {
    fetch(`/post/${postId}/bookmark`, { method: 'POST' })
        .then(response => {
            if (response.status === 401) {
                alert('Please log in to bookmark posts.');
                throw new Error('Not authenticated');
            }
            return response.json();
        })
        .then(data => {
            updateBookmarkUI(button, data.isBookmarked);
            // If on the saved page and unbookmarking, remove the post
            if (window.location.pathname === '/saved' && !data.isBookmarked) {
                const postElement = button.closest('.post');
                if (postElement) {
                    postElement.style.opacity = '0';
                    setTimeout(() => {
                        postElement.remove();
                    }, 300);
                }
            }
        })
        .catch(error => console.error('Error:', error));
}

function updateBookmarkUI(button, isBookmarked) {
    button.classList.toggle('active', isBookmarked);
    const icon = button.querySelector('.material-icons');
    if (icon) {
        icon.textContent = isBookmarked ? 'bookmark' : 'bookmark_border';
    }
}

function reorderTrendingPosts() {
    const postsContainer = document.getElementById('posts-container');
    const posts = Array.from(postsContainer.children);

    posts.sort((a, b) => {
        const scoreA = parseInt(a.dataset.voteScore) || 0;
        const scoreB = parseInt(b.dataset.voteScore) || 0;
        return scoreB - scoreA;
    });

    posts.forEach(post => postsContainer.appendChild(post));
}

function initializeBookmarking() {
    document.addEventListener('click', function(e) {
        const bookmarkBtn = e.target.closest('.bookmark-btn');
        if (!bookmarkBtn) return;

        if (!isLoggedIn) {
            alert('Please log in to bookmark posts.');
            return;
        }

        const postId = bookmarkBtn.dataset.postId;
        handleBookmark(bookmarkBtn, postId);
    });
}

function initializeCommentActions() {
    const commentsSection = document.querySelector('.comments-section');
    if (!commentsSection) return;

    commentsSection.addEventListener('click', function(e) {
        if (!isLoggedIn && (e.target.closest('.btn-add-comment') || e.target.closest('.btn-reply'))) {
            alert('Please log in to comment.');
            return;
        }
    });

    const commentInput = document.querySelector('.comment-input');
    if (commentInput) {
        commentInput.addEventListener('focus', function(e) {
            if (!isLoggedIn) {
                this.blur();
                alert('Please log in to comment.');
            }
        });
    }
}

function initializeTagClickHandlers() {
    document.addEventListener('click', function(e) {
        const tagLink = e.target.closest('.tag');
        if (tagLink && tagLink.tagName === 'A') {
            e.preventDefault();
            const tagName = tagLink.textContent.trim();
            window.location.href = `/search?tag=${encodeURIComponent(tagName)}`;
        }
    });
}


document.addEventListener('DOMContentLoaded', function() {
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');

    searchForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const searchQuery = searchInput.value.trim();
        if (searchQuery) {
            window.location.href = `/search?q=${encodeURIComponent(searchQuery)}`;
        }
    });
});

