/*
     js/script.js
*/

// CKEditor
document.addEventListener('DOMContentLoaded', function() {
    // Initialize CKEditor
    ClassicEditor
        .create(document.querySelector('#editor'), {
            toolbar: ['heading', '|', 'bold', 'italic', 'link', 'bulletedList', 'numberedList', 'blockQuote', 'insertTable', 'imageUpload', 'undo', 'redo'],
            image: {
                toolbar: ['imageTextAlternative', '|', 'imageStyle:alignLeft', 'imageStyle:full', 'imageStyle:alignRight'],
                styles: [
                    'full',
                    'alignLeft',
                    'alignRight',
                ],
                upload: {
                    types: ['jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff']
                },
            },
            simpleUpload: {
                uploadUrl: '/upload-image',
                headers: {
                    'X-CSRF-TOKEN': 'CSRF-Token',
                    Authorization: 'Bearer <JSON Web Token>'
                }
            }
        })
        .catch(error => {
            console.error(error);
        });

    // Handle tag input
    const tagInput = document.getElementById('post-tags');
    const tagsContainer = document.getElementById('tags-container');
    const tags = new Set();

    tagInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const tag = this.value.trim();
            if (tag && !tags.has(tag)) {
                tags.add(tag);
                const tagElement = document.createElement('span');
                tagElement.classList.add('tag');
                tagElement.innerHTML = `${tag} <span class="material-icons">close</span>`;
                tagElement.querySelector('.material-icons').addEventListener('click', function() {
                    tags.delete(tag);
                    tagElement.remove();
                });
                tagsContainer.appendChild(tagElement);
                this.value = '';
            }
        }
    });

    // Handle form submission
    document.getElementById('post-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const title = document.getElementById('post-title').value;
        const description = document.querySelector('.ck-editor__editable').innerHTML;
        // Here you would typically send this data to your server
        console.log({ title, description, tags: Array.from(tags) });
    });
});

// Comments
document.addEventListener('DOMContentLoaded', function() {
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
});

// Fetch Posts
document.addEventListener('DOMContentLoaded', function() {
    const editButtons = document.querySelectorAll('.edit-post');
    const postForm = document.getElementById('post-form');
    let isEditing = false;
    let editingPostId = null;

    editButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            const postId = this.dataset.postId;
            editingPostId = postId;
            isEditing = true;
            fetchPostData(postId);
        });
    });

    function fetchPostData(postId) {
        fetch(`/api/posts/${postId}`)
            .then(response => response.json())
            .then(data => {
                populateForm(data);
            })
            .catch(error => console.error('Error:', error));
    }

    function populateForm(data) {
        document.getElementById('post-title').value = data.title;
        document.getElementById('editor').value = data.content;
        // Populate tags
        const tagsContainer = document.getElementById('tags-container');
        tagsContainer.innerHTML = '';
        data.tags.forEach(tag => addTag(tag));
        
        // Change form title and button text
        document.querySelector('.post-title').textContent = 'Edit Post';
        document.querySelector('.btn-primary').textContent = 'Update Post';
    }

    postForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = new FormData(this);
        const url = isEditing ? `/api/posts/${editingPostId}` : '/api/posts';
        const method = isEditing ? 'PUT' : 'POST';

        fetch(url, {
            method: method,
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            // Handle success (e.g., show a success message, redirect)
            window.location.href = `/post/${data.id}`;
        })
        .catch(error => console.error('Error:', error));
    });
});

// Navigation bar active when clicked
document.addEventListener('DOMContentLoaded', function() {
    const sidebarLinks = document.querySelectorAll('.left-column nav ul li a');
    
    sidebarLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            // Remove active class from all links
            sidebarLinks.forEach(l => l.classList.remove('active'));
            
            // Add active class to clicked link
            this.classList.add('active');
            
            // If you're using client-side routing, you might want to prevent the default action
            // e.preventDefault();
            
            // You could add your routing logic here
        });
    });
    
    // Set active class based on current URL
    const currentPath = window.location.pathname;
    sidebarLinks.forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        }
    });
});

// Tags
document.addEventListener('DOMContentLoaded', function() {
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
        if (tags.has(tag)) return;
        tags.add(tag);
        const tagElement = document.createElement('span');
        tagElement.classList.add('tag');
        tagElement.dataset.tag = tag;
        tagElement.innerHTML = `${tag} <span class="material-icons remove-tag">close</span>`;
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

    // Initialize CKEditor for About Me
    if (document.getElementById('about-me')) {
        ClassicEditor
            .create(document.getElementById('about-me'), {
                toolbar: ['heading', '|', 'bold', 'italic', 'link', 'bulletedList', 'numberedList', 'blockQuote'],
                placeholder: 'Tell us about yourself...'
            })
            .catch(error => {
                console.error(error);
            });
    }
});
