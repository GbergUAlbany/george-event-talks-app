/**
 * BigQuery Release Pulse - Client Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    // State Variables
    let allReleases = [];
    let filteredReleases = [];
    let currentFilterType = 'all';
    let currentSearchQuery = '';
    let selectedReleaseId = null;

    // DOM Elements
    const loader = document.getElementById('loader');
    const feedContainer = document.getElementById('feed-container');
    const emptyState = document.getElementById('empty-state');
    const refreshBtn = document.getElementById('refresh-btn');
    const refreshIcon = document.getElementById('refresh-icon');
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search');
    const resetFiltersBtn = document.getElementById('reset-filters-btn');
    const syncStatusText = document.getElementById('sync-status');
    const statusBanner = document.getElementById('status-banner');
    const statusBannerText = document.getElementById('status-banner-text');
    const closeBannerBtn = document.getElementById('close-banner');

    // Stats Elements
    const statTotal = document.getElementById('stat-total');
    const statFeatures = document.getElementById('stat-features');
    const statIssues = document.getElementById('stat-issues');
    const statAnnouncements = document.getElementById('stat-announcements');

    // Composer Elements
    const composerPanel = document.getElementById('composer-panel');
    const composerBackdrop = document.getElementById('composer-backdrop');
    const closeComposerBtn = document.getElementById('close-composer');
    const cancelTweetBtn = document.getElementById('cancel-tweet-btn');
    const sendTweetBtn = document.getElementById('send-tweet-btn');
    const tweetTextarea = document.getElementById('tweet-textarea');
    const composerBadge = document.getElementById('composer-badge');
    const composerDate = document.getElementById('composer-date');
    const composerOriginalText = document.getElementById('composer-original-text');
    const mockupText = document.getElementById('mockup-text');
    const mockupLinkTitle = document.getElementById('mockup-link-title');
    const charCountText = document.getElementById('char-count');
    const charRingProgress = document.getElementById('char-ring-progress');
    const charWarning = document.getElementById('char-warning');

    // Toast Notification
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');

    // Filter pills
    const filterPills = document.querySelectorAll('.filter-pill');
    const statCards = document.querySelectorAll('.stat-card');

    /* ==========================================================================
       API Functions
       ========================================================================== */
    
    // Fetch releases from Python backend
    async function fetchReleases(forceRefresh = false) {
        setLoading(true);
        const url = `/api/releases${forceRefresh ? '?refresh=true' : ''}`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Server returned HTTP ${response.status}`);
            }
            const data = await response.json();
            
            allReleases = data.updates || [];
            
            // Set last sync timestamp
            if (data.last_updated) {
                const date = new Date(data.last_updated);
                syncStatusText.textContent = `Last checked: ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
            }

            // Handle status banner for cached fallback
            if (data.is_fallback) {
                statusBannerText.textContent = `Using offline cache due to a connection issue: ${data.error || 'Unknown error'}`;
                statusBanner.classList.remove('hidden');
            } else {
                statusBanner.classList.add('hidden');
            }
            
            applyFilters();
            updateStatsWidget();
            showToast(forceRefresh ? "Feed refreshed successfully" : "Loaded release notes");
        } catch (error) {
            console.error("Error fetching release notes:", error);
            showToast("Failed to fetch release notes", true);
            
            if (allReleases.length === 0) {
                statusBannerText.textContent = `Failed to fetch updates: ${error.message}. Please check if python server is running properly.`;
                statusBanner.classList.remove('hidden');
            }
        } finally {
            setLoading(false);
        }
    }

    // Set loading state
    function setLoading(isLoading) {
        if (isLoading) {
            loader.classList.remove('hidden');
            feedContainer.classList.add('hidden');
            emptyState.classList.add('hidden');
            refreshIcon.classList.add('spin');
            refreshBtn.disabled = true;
        } else {
            loader.classList.add('hidden');
            refreshIcon.classList.remove('spin');
            refreshBtn.disabled = false;
        }
    }

    /* ==========================================================================
       UI Rendering & DOM Population
       ========================================================================== */
    
    // Group filtered releases by date and render
    function renderReleases() {
        feedContainer.innerHTML = '';
        
        if (filteredReleases.length === 0) {
            feedContainer.classList.add('hidden');
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');
        feedContainer.classList.remove('hidden');

        // Group by date string
        const grouped = {};
        filteredReleases.forEach(item => {
            if (!grouped[item.date]) {
                grouped[item.date] = [];
            }
            grouped[item.date].push(item);
        });

        // Loop through grouped items and insert elements
        Object.keys(grouped).forEach(date => {
            const dateGroup = document.createElement('div');
            dateGroup.className = 'date-group';

            // Date Header
            const dateHeader = document.createElement('h4');
            dateHeader.className = 'date-heading';
            dateHeader.innerHTML = `<i class="fa-regular fa-calendar-days"></i> ${date}`;
            dateGroup.appendChild(dateHeader);

            const itemsContainer = document.createElement('div');
            itemsContainer.className = 'date-group-items';

            grouped[date].forEach(item => {
                const card = document.createElement('div');
                card.className = `release-card ${selectedReleaseId === item.id ? 'selected' : ''}`;
                card.setAttribute('data-id', item.id);
                card.setAttribute('data-type', item.type);

                // Safe icon type
                let iconClass = 'fa-regular fa-circle-dot';
                if (item.type === 'Feature') iconClass = 'fa-solid fa-circle-play';
                if (item.type === 'Announcement') iconClass = 'fa-solid fa-bullhorn';
                if (item.type === 'Issue') iconClass = 'fa-solid fa-triangle-exclamation';
                if (item.type === 'Changed') iconClass = 'fa-solid fa-clock-rotate-left';
                if (item.type === 'Deprecated') iconClass = 'fa-solid fa-ban';

                card.innerHTML = `
                    <div class="card-header">
                        <div class="badge-and-title">
                            <span class="badge"><i class="${iconClass}"></i> ${item.type}</span>
                        </div>
                        <div class="card-actions-top">
                            <button class="card-action-btn tweet-btn" title="Tweet about this update">
                                <i class="fa-brands fa-x-twitter"></i>
                            </button>
                            <button class="card-action-btn copy-btn" title="Copy detail link">
                                <i class="fa-regular fa-copy"></i>
                            </button>
                        </div>
                    </div>
                    <div class="card-body">
                        ${item.html}
                    </div>
                `;

                // Card Click selects card and opens composer
                card.addEventListener('click', (e) => {
                    // Prevent opening composer if user is copying text or clicking a link inside card
                    if (e.target.tagName === 'A' || e.target.closest('a') || e.target.closest('.card-action-btn')) {
                        return;
                    }
                    selectRelease(item);
                });

                // Tweet Button handler
                card.querySelector('.tweet-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    selectRelease(item);
                });

                // Copy Link Button handler
                card.querySelector('.copy-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    const link = item.feed_link || "https://docs.cloud.google.com/bigquery/docs/release-notes";
                    navigator.clipboard.writeText(link).then(() => {
                        showToast("Link copied to clipboard!");
                    }).catch(err => {
                        console.error('Failed to copy link: ', err);
                    });
                });

                itemsContainer.appendChild(card);
            });

            dateGroup.appendChild(itemsContainer);
            feedContainer.appendChild(dateGroup);
        });
    }

    /* ==========================================================================
       Stats & Filters
       ========================================================================== */
    
    // Update overview stats badges based on all releases (unfiltered)
    function updateStatsWidget() {
        const counts = {
            total: allReleases.length,
            features: 0,
            issues: 0,
            announcements: 0
        };

        allReleases.forEach(item => {
            if (item.type === 'Feature') counts.features++;
            else if (item.type === 'Issue') counts.issues++;
            else if (item.type === 'Announcement') counts.announcements++;
        });

        statTotal.textContent = counts.total;
        statFeatures.textContent = counts.features;
        statIssues.textContent = counts.issues;
        statAnnouncements.textContent = counts.announcements;
    }

    // Filter matching releases by active pills + search query
    function applyFilters() {
        const query = currentSearchQuery.toLowerCase().trim();
        
        filteredReleases = allReleases.filter(item => {
            const matchesType = (currentFilterType === 'all' || item.type === currentFilterType);
            
            const itemText = item.text.toLowerCase();
            const itemType = item.type.toLowerCase();
            const itemDate = item.date.toLowerCase();
            
            const matchesSearch = !query || 
                                  itemText.includes(query) || 
                                  itemType.includes(query) || 
                                  itemDate.includes(query);
                                  
            return matchesType && matchesSearch;
        });

        renderReleases();
    }

    // Set filter category pill
    function setCategoryFilter(type) {
        currentFilterType = type;
        
        // Update Pills UI
        filterPills.forEach(pill => {
            if (pill.getAttribute('data-type') === type) {
                pill.classList.add('active');
            } else {
                pill.classList.remove('active');
            }
        });

        applyFilters();
    }

    /* ==========================================================================
       Composer Logic (Tweet Customization)
       ========================================================================== */
    
    // Select an update to compose tweet
    function selectRelease(item) {
        selectedReleaseId = item.id;
        
        // Highlight selected card in list
        document.querySelectorAll('.release-card').forEach(card => {
            if (card.getAttribute('data-id') === item.id) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        });

        // Set up composer parameters
        composerBadge.className = 'badge';
        // Add specific class for badge styling
        let typeClass = 'badge-fallback';
        if (item.type === 'Feature') typeClass = 'text-feature';
        if (item.type === 'Announcement') typeClass = 'text-announcement';
        if (item.type === 'Issue') typeClass = 'text-issue';
        if (item.type === 'Changed') typeClass = 'text-changed';
        if (item.type === 'Deprecated') typeClass = 'text-deprecated';
        
        composerBadge.textContent = item.type;
        composerBadge.style.color = `var(--color-${item.type.toLowerCase()}, var(--text-primary))`;
        composerDate.textContent = item.date;
        composerOriginalText.innerHTML = item.html;

        // Auto-generate beautiful tweet text
        const cleanText = item.text.replace(/\s+/g, ' ').trim();
        const link = item.feed_link || "https://docs.cloud.google.com/bigquery/docs/release-notes";
        
        const prefix = `BigQuery [${item.type}] update (${item.date}): `;
        const suffix = `\n\nDetails: ${link}\n#BigQuery #GoogleCloud`;
        
        // standard Tweet is 280 chars
        const allowedLength = 280 - prefix.length - suffix.length;
        let shortText = cleanText;
        if (shortText.length > allowedLength) {
            shortText = shortText.slice(0, allowedLength - 3) + "...";
        }
        
        const defaultTweet = `${prefix}${shortText}${suffix}`;
        tweetTextarea.value = defaultTweet;

        // Update mockup preview title
        mockupLinkTitle.textContent = `BigQuery Release notes (${item.date}) | Google Cloud`;

        // Update counts and mockup preview
        updateTweetLength();

        // Open composer panel
        composerPanel.classList.add('active');
    }

    // Recalculate character counts, SVG indicator ring, and update preview mockup
    function updateTweetLength() {
        const text = tweetTextarea.value;
        const count = text.length;
        
        // Update character counter text
        charCountText.textContent = `${count}/280`;

        // Update circular progress ring
        // perimeter = 2 * PI * r (where r=10) = ~62.8
        const perimeter = 2 * Math.PI * 10;
        let progress = Math.min(count / 280, 1.0);
        let offset = perimeter - (perimeter * progress);
        
        charRingProgress.style.strokeDashoffset = offset;
        
        // Progress ring styling based on usage
        if (count > 280) {
            charRingProgress.style.stroke = 'var(--color-issue)';
            charCountText.style.color = 'var(--color-issue)';
            charWarning.classList.remove('hidden');
        } else if (count > 250) {
            charRingProgress.style.stroke = 'var(--color-changed)';
            charCountText.style.color = 'var(--color-changed)';
            charWarning.classList.add('hidden');
        } else {
            charRingProgress.style.stroke = 'var(--color-primary)';
            charCountText.style.color = 'var(--text-secondary)';
            charWarning.classList.add('hidden');
        }

        // Update X mockup text
        mockupText.textContent = text;
    }

    // Close Tweet Composer
    function closeComposer() {
        composerPanel.classList.remove('active');
        selectedReleaseId = null;
        
        // Remove card highlights
        document.querySelectorAll('.release-card').forEach(card => {
            card.classList.remove('selected');
        });
    }

    // Fire Tweet Web Intent
    function submitTweet() {
        const text = tweetTextarea.value.trim();
        if (!text) return;
        
        const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(tweetUrl, '_blank');
        
        showToast("Opening X / Twitter...");
        closeComposer();
    }

    /* ==========================================================================
       Toast & Banner Events
       ========================================================================== */
       
    // Toast alert triggers
    function showToast(message, isError = false) {
        toastMessage.textContent = message;
        
        if (isError) {
            toast.style.borderColor = 'var(--color-issue)';
            toast.querySelector('.toast-icon').className = 'fa-solid fa-circle-xmark toast-icon';
            toast.querySelector('.toast-icon').style.color = 'var(--color-issue)';
        } else {
            toast.style.borderColor = 'var(--border-hover)';
            toast.querySelector('.toast-icon').className = 'fa-solid fa-circle-check toast-icon';
            toast.querySelector('.toast-icon').style.color = 'var(--color-feature)';
        }
        
        toast.classList.add('active');
        
        setTimeout(() => {
            toast.classList.remove('active');
        }, 3000);
    }

    /* ==========================================================================
       Event Listeners
       ========================================================================== */

    // Refresh Button click
    refreshBtn.addEventListener('click', () => {
        fetchReleases(true);
    });

    // Close Offline banner
    closeBannerBtn.addEventListener('click', () => {
        statusBanner.classList.add('hidden');
    });

    // Search bar typing
    searchInput.addEventListener('input', (e) => {
        currentSearchQuery = e.target.value;
        if (currentSearchQuery) {
            clearSearchBtn.style.display = 'block';
        } else {
            clearSearchBtn.style.display = 'none';
        }
        applyFilters();
    });

    // Clear search button
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        currentSearchQuery = '';
        clearSearchBtn.style.display = 'none';
        applyFilters();
    });

    // Reset filters button (empty states)
    resetFiltersBtn.addEventListener('click', () => {
        searchInput.value = '';
        currentSearchQuery = '';
        clearSearchBtn.style.display = 'none';
        currentFilterType = 'all';
        filterPills.forEach(p => p.classList.remove('active'));
        document.querySelector('.filter-pill[data-type="all"]').classList.add('active');
        applyFilters();
    });

    // Category filter pills
    filterPills.forEach(pill => {
        pill.addEventListener('click', () => {
            const type = pill.getAttribute('data-type');
            setCategoryFilter(type);
        });
    });

    // Sidebar Overview click handlers to trigger category filters
    statCards.forEach(card => {
        card.addEventListener('click', () => {
            const filterAttr = card.getAttribute('data-filter');
            let mappedType = 'all';
            
            if (filterAttr === 'feature') mappedType = 'Feature';
            else if (filterAttr === 'issue') mappedType = 'Issue';
            else if (filterAttr === 'announcement') mappedType = 'Announcement';
            
            setCategoryFilter(mappedType);
        });
    });

    // Composer Input Events
    tweetTextarea.addEventListener('input', updateTweetLength);

    // Close Composer Panel handlers
    closeComposerBtn.addEventListener('click', closeComposer);
    cancelTweetBtn.addEventListener('click', closeComposer);
    composerBackdrop.addEventListener('click', closeComposer);

    // Send tweet handler
    sendTweetBtn.addEventListener('click', submitTweet);

    // Initialize - Fetch notes on startup
    fetchReleases();
});
