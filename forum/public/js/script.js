/*
     js/script.js
*/

document.addEventListener('DOMContentLoaded', function() {
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
});

function initializeCreatePostPage() {
    let editor;

    ClassicEditor
        .create(document.querySelector('#editor'), {
            // ... your CKEditor configuration ...
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

    // ... rest of your initializeCreatePostPage function ...
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

