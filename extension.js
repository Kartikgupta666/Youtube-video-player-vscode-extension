const vscode = require('vscode');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log('Congratulations, your extension "yt" is now active!');

    // Create a shared state for the current video
    const state = {
        currentVideoId: null,
        floatingPanel: null
    };

    // Make state accessible globally for deactivation
    global.state = state;

    // Register the sidebar webview provider
    const provider = new YouTubeViewProvider(context.extensionUri, state);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('youtube-player', provider)
    );

    // Add listener to close the floating player when all editors are closed
    context.subscriptions.push(
        vscode.window.onDidChangeVisibleTextEditors(editors => {
            // Only act if there are no visible editors and we have a floating panel
            if (editors.length === 0 && state.floatingPanel) {
                // Small delay to ensure we're not in the middle of switching editors
                setTimeout(() => {
                    if (vscode.window.visibleTextEditors.length === 0 && state.floatingPanel) {
                        state.floatingPanel.dispose();
                    }
                }, 500);
            }
        })
    );

    // Register the command to open the sidebar
    const openSidebarCommand = vscode.commands.registerCommand('yt.openVideoPlayer', () => {
        // Focus on the YouTube view in the sidebar
        vscode.commands.executeCommand('youtube-player.focus');
    });

    // Register the command to create a floating player
    const floatingPlayerCommand = vscode.commands.registerCommand('yt.createFloatingPlayer', (videoId) => {
        if (state.floatingPanel) {
            // If panel exists, just reveal it
            state.floatingPanel.reveal();

            // If a new video ID was provided, update the player
            if (videoId && videoId !== state.currentVideoId) {
                state.currentVideoId = videoId;
                updateFloatingPlayer(state);
            }
        } else {
            // Create a new floating panel
            const panel = vscode.window.createWebviewPanel(
                'youtubeFloatingPlayer',
                'YouTube Player',
                {
                    viewColumn: vscode.ViewColumn.Beside,
                    preserveFocus: true
                },
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                    localResourceRoots: [vscode.Uri.file(context.extensionPath)]
                }
            );

            state.floatingPanel = panel;
            state.currentVideoId = videoId || state.currentVideoId;

            // Set initial HTML content
            panel.webview.html = getFloatingPlayerContent(state.currentVideoId);

            // Handle panel disposal
            panel.onDidDispose(() => {
                state.floatingPanel = null;
            });

            // Add listener to close the player when the editor is closed
            const disposable = vscode.workspace.onDidCloseTextDocument(document => {
                // Only check for text documents (not webviews)
                if (document.uri.scheme === 'file' && vscode.window.visibleTextEditors.length === 0 && state.floatingPanel) {
                    // Small delay to ensure we're not in the middle of switching editors
                    setTimeout(() => {
                        if (vscode.window.visibleTextEditors.length === 0 && state.floatingPanel) {
                            state.floatingPanel.dispose();
                        }
                    }, 500);
                }
            });

            // Add the disposable to context subscriptions
            context.subscriptions.push(disposable);

            // Handle messages from the webview
            panel.webview.onDidReceiveMessage(message => {
                switch (message.command) {
                    case 'close':
                        panel.dispose();
                        break;

                    case 'minimize':
                        // This is a placeholder - VS Code doesn't have a built-in minimize function
                        // We could hide and show the panel, but for now we'll just notify the user
                        vscode.window.showInformationMessage('Minimize functionality is not available in VS Code webviews.');
                        break;

                    case 'drag':
                        // VS Code doesn't support direct dragging of webview panels
                        // We could implement a custom solution with multiple panels, but it's complex
                        // For now, we'll just notify the user
                        vscode.window.showInformationMessage('Dragging is not fully supported in VS Code webviews. You can use the built-in editor grid to arrange panels.');
                        break;

                    case 'keepAlive':
                        // Do nothing, this is just to keep the connection alive
                        // when the tab is not focused
                        break;

                    case 'resize':
                        // Similar to dragging, direct resizing is not supported
                        // We'll notify the user
                        vscode.window.showInformationMessage('Custom resizing is not fully supported in VS Code webviews. You can resize the panel using the editor grid handles.');
                        break;
                }
            });
        }
    });

    context.subscriptions.push(openSidebarCommand, floatingPlayerCommand);
}

/**
 * Update the floating player with new content
 */
function updateFloatingPlayer(state) {
    if (state.floatingPanel) {
        state.floatingPanel.webview.html = getFloatingPlayerContent(state.currentVideoId);
    }
}

/**
 * Get the HTML content for the floating player
 */
function getFloatingPlayerContent(videoId) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>YouTube Floating Player</title>
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src https://www.youtube.com https://www.youtube-nocookie.com; img-src https://i.ytimg.com https://img.youtube.com data:; script-src 'unsafe-inline'; style-src 'unsafe-inline';" />
    <style>
        :root {
            --vscode-bg: var(--vscode-editor-background, #1e1e1e);
            --vscode-fg: var(--vscode-editor-foreground, #d4d4d4);
            --vscode-button-bg: var(--vscode-button-background, #0e639c);
            --vscode-button-hover-bg: var(--vscode-button-hoverBackground, #1177bb);
            --vscode-button-fg: var(--vscode-button-foreground, white);
            --vscode-panel-border: var(--vscode-panel-border, #80808059);
        }
        
        body {
            background-color: var(--vscode-bg);
            color: var(--vscode-fg);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            margin: 0;
            padding: 0;
            overflow: hidden;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }
        
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 5px 10px;
            background-color: rgba(0, 0, 0, 0.3);
            cursor: move;
            user-select: none;
        }
        
        .title {
            font-size: 12px;
            font-weight: 500;
        }
        
        .controls {
            display: flex;
            gap: 5px;
        }
        
        .control-button {
            background: transparent;
            border: none;
            color: var(--vscode-fg);
            cursor: pointer;
            font-size: 14px;
            padding: 2px 5px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .control-button:hover {
            background-color: rgba(255, 255, 255, 0.1);
        }
        
        .video-container {
            flex: 1;
            position: relative;
            width: 100%;
            background-color: #000;
        }
        
        .video-container iframe {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            border: none;
        }
        
        .resize-handle {
            position: absolute;
            bottom: 0;
            right: 0;
            width: 15px;
            height: 15px;
            cursor: nwse-resize;
            background: transparent;
        }
        
        .resize-handle::after {
            content: '';
            position: absolute;
            right: 3px;
            bottom: 3px;
            width: 5px;
            height: 5px;
            border-right: 2px solid rgba(255, 255, 255, 0.5);
            border-bottom: 2px solid rgba(255, 255, 255, 0.5);
        }
    </style>
</head>
<body>
    <div class="header" id="drag-handle">
        <div class="title">YouTube Player</div>
        <div class="controls">
            <button class="control-button" id="minimize-btn" title="Minimize">−</button>
            <button class="control-button" id="close-btn" title="Close">×</button>
        </div>
    </div>
    
    <div class="video-container">
        ${videoId ? `
        <iframe
            id="youtube-player"
            src="https://www.youtube.com/embed/${videoId}?autoplay=1&modestbranding=1&rel=0&enablejsapi=1&playsinline=1"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen>
        </iframe>
        ` : '<div style="padding: 20px; text-align: center;">No video selected</div>'}
    </div>
    
    <div class="resize-handle" id="resize-handle"></div>

    <script>
        // Make the window draggable
        const dragHandle = document.getElementById('drag-handle');
        
        dragHandle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            
            // Send message to VS Code to start dragging
            const message = {
                command: 'drag',
                mouseX: e.clientX,
                mouseY: e.clientY
            };
            
            // Use window.parent.postMessage for VS Code webview communication
            window.parent.postMessage(message, '*');
        });
        
        // Keep the connection alive with periodic messages
        setInterval(() => {
            window.parent.postMessage({ command: 'keepAlive' }, '*');
        }, 5000);
        
        // Handle close button
        document.getElementById('close-btn').addEventListener('click', () => {
            window.parent.postMessage({ command: 'close' }, '*');
        });
        
        // Handle minimize button
        document.getElementById('minimize-btn').addEventListener('click', () => {
            window.parent.postMessage({ command: 'minimize' }, '*');
        });
        
        // Handle resize
        const resizeHandle = document.getElementById('resize-handle');
        
        resizeHandle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            
            // Send message to VS Code to start resizing
            const message = {
                command: 'resize',
                mouseX: e.clientX,
                mouseY: e.clientY
            };
            
            window.parent.postMessage(message, '*');
        });
        
        // Prevent default behavior for mousedown on the iframe to avoid issues
        document.querySelector('.video-container').addEventListener('mousedown', (e) => {
            e.stopPropagation();
        });
    </script>
</body>
</html>`;
}

/**
 * YouTube Sidebar View Provider
 */
class YouTubeViewProvider {
    constructor(extensionUri, state) {
        this.extensionUri = extensionUri;
        this.state = state;
    }

    resolveWebviewView(webviewView, context, token) {
        this.webviewView = webviewView;

        // Set webview options
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri]
        };

        // Set the HTML content
        webviewView.webview.html = this.getWebviewContent();

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'loadVideo':
                    this.state.currentVideoId = message.videoId;
                    updateFloatingPlayer(this.state);
                    break;

                case 'popOut':
                    vscode.commands.executeCommand('yt.createFloatingPlayer', message.videoId);
                    break;

                case 'keepAlive':
                    // Do nothing, this is just to keep the connection alive
                    break;
            }
        });
    }

    getWebviewContent() {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>YouTube Player</title>
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src https://www.youtube.com https://www.youtube-nocookie.com; img-src https://i.ytimg.com https://img.youtube.com data:; script-src 'unsafe-inline'; style-src 'unsafe-inline';" />
    <style>
        :root {
            --vscode-bg: var(--vscode-sideBar-background, #1e1e1e);
            --vscode-fg: var(--vscode-sideBar-foreground, #d4d4d4);
            --vscode-input-bg: var(--vscode-input-background, #3c3c3c);
            --vscode-button-bg: var(--vscode-button-background, #0e639c);
            --vscode-button-hover-bg: var(--vscode-button-hoverBackground, #1177bb);
            --vscode-button-fg: var(--vscode-button-foreground, white);
            --vscode-focus-border: var(--vscode-focusBorder, #007fd4);
            --vscode-panel-border: var(--vscode-panel-border, #80808059);
            --vscode-error-color: var(--vscode-errorForeground, #f48771);
            --container-padding: 10px;
            --input-height: 28px;
        }
        
        body {
            background-color: var(--vscode-bg);
            color: var(--vscode-fg);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            padding: var(--container-padding);
            margin: 0;
            line-height: 1.5;
            font-size: 13px;
        }
        
        .container {
            width: 100%;
        }
        
        h1 {
            font-size: 1.2rem;
            margin-bottom: 0.8rem;
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 0.5rem;
        }
        
        .input-group {
            display: flex;
            margin-bottom: 0.8rem;
            gap: 6px;
        }
        
        input[type="text"] {
            flex: 1;
            background-color: var(--vscode-input-bg);
            border: 1px solid transparent;
            color: var(--vscode-fg);
            padding: 0 8px;
            height: var(--input-height);
            border-radius: 2px;
            outline: none;
            font-size: 13px;
        }
        
        input[type="text"]:focus {
            border-color: var(--vscode-focus-border);
        }
        
        button {
            background-color: var(--vscode-button-bg);
            color: var(--vscode-button-fg);
            border: none;
            padding: 0 8px;
            height: var(--input-height);
            border-radius: 2px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            transition: background-color 0.2s;
        }
        
        button:hover {
            background-color: var(--vscode-button-hover-bg);
        }
        
        .video-container {
            position: relative;
            width: 100%;
            padding-top: 56.25%; /* 16:9 Aspect Ratio */
            margin-top: 0.8rem;
            background-color: #000;
            border-radius: 2px;
            overflow: hidden;
        }
        
        .video-container iframe {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            border: none;
        }
        
        .placeholder {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background-color: rgba(0, 0, 0, 0.7);
            color: #fff;
        }
        
        .placeholder svg {
            width: 48px;
            height: 48px;
            margin-bottom: 12px;
            fill: #ff0000;
        }
        
        .placeholder-text {
            font-size: 12px;
            text-align: center;
            padding: 0 10px;
        }
        
        .error-message {
            color: var(--vscode-error-color);
            margin-top: 0.5rem;
            font-size: 12px;
            display: none;
        }
        
        .history {
            margin-top: 1.5rem;
        }
        
        .history h2 {
            font-size: 0.9rem;
            margin-bottom: 0.5rem;
        }
        
        .history-list {
            list-style: none;
            padding: 0;
            margin: 0;
            max-height: 200px;
            overflow-y: auto;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 2px;
        }
        
        .history-item {
            padding: 6px 8px;
            cursor: pointer;
            border-bottom: 1px solid var(--vscode-panel-border);
            display: flex;
            align-items: center;
        }
        
        .history-item:last-child {
            border-bottom: none;
        }
        
        .history-item:hover {
            background-color: rgba(255, 255, 255, 0.1);
        }
        
        .history-item img {
            width: 80px;
            height: 45px;
            margin-right: 8px;
            border-radius: 2px;
        }
        
        .history-item-info {
            flex: 1;
            min-width: 0; /* Allows text truncation to work */
        }
        
        .history-item-title {
            font-weight: 500;
            margin-bottom: 2px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            font-size: 12px;
        }
        
        .history-item-id {
            font-size: 11px;
            color: rgba(255, 255, 255, 0.6);
        }
        
        .action-buttons {
            display: flex;
            justify-content: flex-end;
            margin-top: 8px;
            gap: 6px;
        }
        
        .icon-button {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 12px;
        }
        
        .icon-button svg {
            width: 14px;
            height: 14px;
            fill: currentColor;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>YouTube Player</h1>
        
        <div class="input-group">
            <input type="text" id="url" placeholder="Enter YouTube URL or video ID" autofocus>
            <button onclick="handleClick()">Load</button>
        </div>
        
        <div id="error-message" class="error-message"></div>
        
        <div class="video-container">
    <div id="output"></div>
            <div id="placeholder" class="placeholder">
                <svg viewBox="0 0 24 24">
                    <path d="M10,15L15.19,12L10,9V15M21.56,7.17C21.69,7.64 21.78,8.27 21.84,9.07C21.91,9.87 21.94,10.56 21.94,11.16L22,12C22,14.19 21.84,15.8 21.56,16.83C21.31,17.73 20.73,18.31 19.83,18.56C19.36,18.69 18.5,18.78 17.18,18.84C15.88,18.91 14.69,18.94 13.59,18.94L12,19C7.81,19 5.2,18.84 4.17,18.56C3.27,18.31 2.69,17.73 2.44,16.83C2.31,16.36 2.22,15.73 2.16,14.93C2.09,14.13 2.06,13.44 2.06,12.84L2,12C2,9.81 2.16,8.2 2.44,7.17C2.69,6.27 3.27,5.69 4.17,5.44C4.64,5.31 5.5,5.22 6.82,5.16C8.12,5.09 9.31,5.06 10.41,5.06L12,5C16.19,5 18.8,5.16 19.83,5.44C20.73,5.69 21.31,6.27 21.56,7.17Z" />
                </svg>
                <div class="placeholder-text">Enter a YouTube URL to start watching</div>
            </div>
        </div>
        
        <div class="action-buttons">
            <button id="pop-out-btn" class="icon-button" title="Pop out player" onclick="popOutPlayer()">
                <svg viewBox="0 0 24 24">
                    <path d="M19,19H5V5H19M19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5A2,2 0 0,0 19,3M13.96,12.29L11.21,15.83L9.25,13.47L6.5,17H17.5L13.96,12.29Z" />
                </svg>
                Pop Out
            </button>
        </div>
        
        <div class="history" id="history-container">
            <h2>Recently Watched</h2>
            <ul class="history-list" id="history-list"></ul>
        </div>
    </div>

    <script>
        // Store watch history in memory
        let watchHistory = [];
        const MAX_HISTORY = 5;
        let currentVideoId = null;
        
        // Create a function to communicate with the extension
        const vscode = acquireVsCodeApi();
        
        // Try to load history from localStorage if available
        try {
            const savedHistory = localStorage.getItem('youtube-history');
            if (savedHistory) {
                watchHistory = JSON.parse(savedHistory);
                updateHistoryUI();
            }
        } catch (e) {
            console.error('Failed to load history:', e);
        }
        
        function handleClick() {
            let url = document.querySelector("#url").value.trim();
            loadVideo(url);
        }
        
        function loadVideo(url) {
            try {
                // Clear previous error message
                const errorElement = document.getElementById("error-message");
                errorElement.style.display = "none";
                errorElement.textContent = "";
                
                // Extract video ID from URL or use as direct ID
                let videoId;
                
                if (url.includes("youtube.com") || url.includes("youtu.be")) {
                    // Handle youtube.com URLs
                    if (url.includes("youtube.com")) {
                        videoId = new URL(url).searchParams.get("v");
                    } 
                    // Handle youtu.be URLs
                    else if (url.includes("youtu.be")) {
                        videoId = url.split("/").pop().split("?")[0];
                    }
                } else {
                    // Assume it's a direct video ID
                    videoId = url;
                }
                
                if (!videoId) {
                    showError("Could not extract video ID from URL");
                    return;
                }

                // Store the current video ID
                currentVideoId = videoId;
                
                // Notify the extension about the video change
                vscode.postMessage({
                    command: 'loadVideo',
                    videoId: videoId
                });

                // Create embed URL - use modest branding and smaller controls for sidebar
                let embedUrl = \`https://www.youtube.com/embed/\${videoId}?autoplay=1&modestbranding=1&rel=0\`;
                let embedCode = \`
                    <iframe
                        src="\${embedUrl}"
                        frameborder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowfullscreen>
                    </iframe>
                \`;

                // Update the output and hide placeholder
                document.querySelector("#output").innerHTML = embedCode;
                document.querySelector("#placeholder").style.display = "none";
                
                // Add to watch history
                addToHistory(videoId);
            } catch (error) {
                showError("Please enter a valid YouTube URL or video ID");
                console.error(error);
            }
        }
        
        function popOutPlayer() {
            if (!currentVideoId) {
                showError("Please load a video first");
                return;
            }
            
            // Send message to create floating player
            vscode.postMessage({
                command: 'popOut',
                videoId: currentVideoId
            });
        }
        
        function showError(message) {
            const errorElement = document.getElementById("error-message");
            errorElement.textContent = message;
            errorElement.style.display = "block";
        }
        
        function addToHistory(videoId) {
            // Check if already in history
            const existingIndex = watchHistory.findIndex(item => item.id === videoId);
            if (existingIndex !== -1) {
                // Move to top if already exists
                const item = watchHistory.splice(existingIndex, 1)[0];
                watchHistory.unshift(item);
            } else {
                // Fetch video title and thumbnail (in a real extension, you'd use the YouTube API)
                // For now, we'll just use the video ID as the title
                watchHistory.unshift({
                    id: videoId,
                    title: "Video " + videoId,
                    thumbnail: \`https://i.ytimg.com/vi/\${videoId}/mqdefault.jpg\`
                });
                
                // Limit history size
                if (watchHistory.length > MAX_HISTORY) {
                    watchHistory.pop();
                }
            }
            
            // Update history UI
            updateHistoryUI();
            
            // Try to save to localStorage if available
            try {
                localStorage.setItem('youtube-history', JSON.stringify(watchHistory));
            } catch (e) {
                console.error('Failed to save history:', e);
            }
        }
        
        function updateHistoryUI() {
            const historyList = document.getElementById("history-list");
            historyList.innerHTML = "";
            
            watchHistory.forEach(video => {
                const item = document.createElement("li");
                item.className = "history-item";
                item.onclick = () => {
                    document.querySelector("#url").value = video.id;
                    loadVideo(video.id);
                };
                
                item.innerHTML = \`
                    <img src="\${video.thumbnail}" alt="\${video.title}">
                    <div class="history-item-info">
                        <div class="history-item-title">\${video.title}</div>
                        <div class="history-item-id">\${video.id}</div>
                    </div>
                \`;
                
                historyList.appendChild(item);
            });
            
            // Show/hide history container based on whether we have items
            document.getElementById("history-container").style.display = 
                watchHistory.length > 0 ? "block" : "none";
        }
        
        // Initialize
        document.getElementById("history-container").style.display = 
            watchHistory.length > 0 ? "block" : "none";
        
        // Handle Enter key in the input field
        document.querySelector("#url").addEventListener("keyup", function(event) {
            if (event.key === "Enter") {
                handleClick();
            }
        });
        
        // Keep the connection alive with periodic messages
        setInterval(() => {
            window.parent.postMessage({ command: 'keepAlive' }, '*');
        }, 5000);
    </script>
</body>
</html>`;
    }
}

function deactivate() {
    // Close any open floating panels when the extension is deactivated
    try {
        if (global.state && global.state.floatingPanel) {
            global.state.floatingPanel.dispose();
            global.state.floatingPanel = null;
        }
    } catch (error) {
        console.error('Error during deactivation:', error);
    }
}

module.exports = {
    activate,
    deactivate
};

