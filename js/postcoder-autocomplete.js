/**
 * Accessible address autocomplete UI for the PostCoder Web API from Allies Computing
 * Heavily based on Awesomplete by Lea Verou http://leaverou.github.io/awesomplete
 * @author Allies Computing https://www.alliescomputing.com
 * MIT license
 */
(function () {

    var _ = function (address_input, o) {
        var me = this;

        // Keep track of number of instances for unique IDs
        AlliesComplete.numInstances = (AlliesComplete.numInstances || 0) + 1;

        this.isOpened = false;

        // Adjust the address field attributes
        this.address_input = $(address_input);
        this.address_input.setAttribute("autocomplete", "nothanks"); // As browsers ignore "off"
        this.address_input.setAttribute("autocorrect", "off");
        this.address_input.setAttribute("autocapitalize", "off");
        this.address_input.setAttribute("spellcheck", "false");
        this.address_input.setAttribute("aria-owns", "postcoder_complete_list_" + AlliesComplete.numInstances);
        this.address_input.setAttribute("role", "combobox");

        // Default objects, recommend these are overwritten using the settings object when creating the instance
        var default_icon_html = {
            "back": "<i class='fa fa-chevron-left fa-fw' aria-hidden='true'></i>",
            "address": "<i class='fa fa-map-marker fa-fw' aria-hidden='true'></i>",
            "collection": "<i class='fa fa-search fa-fw' aria-hidden='true'></i>",
            "error": "<i class='fa fa-exclamation-triangle fa-fw' aria-hidden='true'></i>"
        };

        var language_gb_en = {
            "connection_error":"Connection error",
            "error":"Error",
            "filter":"Filter",
            "filter_remove":"Click to remove filter",
            "result_found": "result found",
            "result_found_plural": "results found",
            "address":"Address",
            "address_plural":"Addresses",
            "address_status_init": "Type [minChars] or more characters for results",
            "address_selected":"Address selected and address fields have been populated",
            "address_api_error":"Error from address API",
            "address_collection":"Collection of addresses",
            "address_not_found":"No address results found"
        };

        o = o || {};

        // Default options
        configure(this, {
            apiKey: "PCW45-12345-12345-1234X",        // For this example, you should leave this key as it is and replace the test key in `js-example.html`, as that will overwrite this default
            endpoint: "address",                      // Endpoint to get final address data from when user selects an address from list
            addresslines: 2,                          // Number of address lines to split elements over
            excludeFields: "organisation",            // Comma seperated list of fields to exclude from address lines output
            maxItems: 100,                            // How many items to show in list below search box
            showFullCounts: false,                    // False will set anything over 100 to "100+"
            iconHtml: default_icon_html,              // Icon object
            autocompleteLabel: false,                 // The label tag as DOM element
            autocompleteWrapper: false,               // The wrapper of the address finder as DOM element
            country: "GB",                            // The country
            languageObject: language_gb_en,           // Language object
            identifier: "Autocomplete Address Finder" // To tag each search when viewing your usage on admin.postcoder.com
        }, o);

        this.retrieve_url = "https://ws.postcoder.com/pcw/autocomplete/retrieve";
        this.autocomplete_url = "https://ws.postcoder.com/pcw/autocomplete/find";

        this.index = -1;

        this.minChars = 3;

        this.previousFilters = [];

        // Create necessary additional DOM elements for the address field

        this.container = $.create("div", {
            className: "postcoder-complete",
            around: address_input
        });

        this.dropdown = $.create("div", {
            className: "postcoder-complete-dropdown",
            hidden: "hidden",
            id: "postcoder_complete_dropdown_" + AlliesComplete.numInstances,
            inside: this.container
        });

        this.header = $.create("header", {
            id: "postcoder_complete_list_header_" + AlliesComplete.numInstances,
            inside: this.dropdown,
            hidden: "hidden",
        });

        this.headerIcon = $.create("span", {
            id: "postcoder_complete_list_header_icon_" + AlliesComplete.numInstances,
            innerHTML: "",
            inside: this.header
        });

        this.headerText = $.create("span", {
            id: "postcoder_complete_list_header_text_" + AlliesComplete.numInstances,
            inside: this.header
        });

        this.currentPathFilter = $.create("span", {
            id: "postcoder_complete_list_filter_" + AlliesComplete.numInstances,
            "data-filter": "",
            "data-search-term": "",
            "data-that-generated-filter": "",
            hidden: "hidden",
            innerHTML: "",
            inside: this.header
        });

        this.ul = $.create("ul", {
            role: "listbox",
            id: "postcoder_complete_list_" + AlliesComplete.numInstances,
            inside: this.dropdown
        });

        this.status = $.create("span", {
            className: "visually-hidden",
            role: "status",
            id: "postcoder_complete_status_" + AlliesComplete.numInstances,
            "aria-live": "assertive",
            "aria-relevant": "all",
            "aria-atomic": true,
            inside: this.container,
            textContent: this.languageObject.address_status_init.replace("[minChars]", this.minChars)
        });

        this.error = $.create("div", {
            className: "postcoder-complete-error",
            role: "alert",
            id: "postcoder_complete_error_" + AlliesComplete.numInstances,
            "aria-relevant": "additions text",
            textContent: "",
            hidden: "hidden",
            inside: this.container
        });

        // Bind events

        this._events = {
            address_input: {
                "address_input": this.address_evaluate.bind(this),
                "blur": function() {
                    // prevent closing the menu on iOS when keyboard closes
                    if ($.isIosDevice() === false) {
                        me.close({
                            reason: "blur"
                        });
                    }
                },
                "keydown": function (evt) {
                    var c = evt.keyCode;

                    // remove filter if deleting text that was used to apply the filter
                    if (me.currentPathFilter.getAttribute("data-filter") != "") {
                        var term_at_filter = me.currentPathFilter.getAttribute("data-that-generated-filter").trim();
                        if(term_at_filter.length > me.address_input.value.trim().length) {
                            update_filter (me, "", true);
                        }
                    }

                    // If the dropdown `ul` is in view, then act on keydown for the following keys:
                    // Enter / Esc / Up / Down
                    if (me.opened) {
                        if (c === 13 && me.selected) { // Enter
                            evt.preventDefault();
                            me.select();
                        } else if (c === 27) { // Esc
                            me.close({
                                reason: "esc"
                            });
                        } else if (c === 38 || c === 40) { // Down/Up arrow
                            evt.preventDefault();
                            me[c === 38 ? "previous" : "next"]();
                        }
                    }
                },
                "keyup": function (evt) {

                    var c = evt.keyCode;

                    // Arrows (37,38,39,40), Esc (27), Enter(13), Home(36), End(35)
                    if (c !== 37 && c !== 38 && c !== 39 && c !== 40 && c !== 27 && c !== 13 && c !== 36 && c !== 35) {

                        if (me.address_input.value.trim().length >= me.minChars) {

                            // Search for address
                            browseAddress(me);

                        }
                    }
                },
                "focus": function () {
                    if(me.ul.children.length !== 0) {
                        me.open();
                    }
                }
            },
            form: {
                "submit": function() {
                    this.close.bind(this, { reason: "submit" });
                }
            },
            ul: {
                "mousedown": function(evt) {
                    var li = evt.target;

                    if (li !== this) {

                        while (li && !/li/i.test(li.nodeName)) {
                            li = li.parentNode;
                        }

                        if (li && evt.button === 0) { // Only select on left click
                            evt.preventDefault();
                            me.select(li, evt.target);
                        }
                    }
                }
            },
            header: {
                // Goes back a filter if the header is clicked
                "mousedown": function(evt) {
                    if (evt.button === 0) { // Only trigger on left click
                        evt.preventDefault();
                        // If there is someting in the search box when deleting the header, search again. If not, don't search again, because that will display a "no query provided" error.
                        if (me.address_input.value) {
                            update_filter (me, "", true);
                        } else {
                            update_filter (me, "", false);
                        }
                        // Hide the header if nothing to display in it
                        if (me.currentPathFilter.hidden && me.error.hidden){
                            update_header(me, "", false);
                        }
                    }
                }
            }
        };

        $.bind(this.address_input, this._events.address_input);
        $.bind(this.address_input.form, this._events.form);
        $.bind(this.ul, this._events.ul);
        $.bind(this.header, this._events.header);

        this.list = [];

        _.all.push(this);
    };

    _.prototype = {
        set list(list) {
            if (Array.isArray(list)) {
                this._list = list;
            } else if (typeof list === "string" && list.indexOf(",") > -1) {
                this._list = list.split(/\s*,\s*/);
            } else { // Element or CSS selector
                list = $(list);

                if (list && list.children) {
                    var items = [];
                    slice.apply(list.children).forEach(function(el) {
                        if (!el.disabled) {
                            var text = el.textContent.trim();
                            var value = el.value || text;
                            var label = el.label || text;
                            if (value !== "") {
                                items.push({
                                    label: label,
                                    value: value
                                });
                            }
                        }
                    });
                    this._list = items;
                }
            }

            if (document.activeElement === this.address_input) {
                this.address_evaluate();
            }
        },

        get selected() {
            return this.index > -1;
        },

        get opened() {
            return this.isOpened;
        },

        close: function(o) {
            if (!this.opened) {
                return;
            }

            this.dropdown.setAttribute("hidden", "");
            this.isOpened = false;
            this.index = -1;

            $.fire(this.address_input, "postcoder-complete-close", o || {});
        },

        open: function() {
            this.dropdown.removeAttribute("hidden");
            this.isOpened = true;

            $.fire(this.address_input, "postcoder-complete-open");
        },

        next: function() {
            var count = this.ul.children.length;
            this.goto(this.index < count - 1 ? this.index + 1 : (count ? 0 : -1));
        },

        previous: function() {
            var count = this.ul.children.length;
            var pos = this.index - 1;

            this.goto(this.selected && pos !== -1 ? pos : count - 1);
        },

        goto: function(i) {
            var lis = this.ul.children;

            if (this.selected) {
                lis[this.index].setAttribute("aria-selected", "false");
            }

            this.index = i;

            if (i > -1 && lis.length > 0) {
                lis[i].setAttribute("aria-selected", "true");

                this.status.textContent = lis[i].textContent + ", list item " + (i + 1) + " of " + lis.length;

                this.address_input.setAttribute("aria-activedescendant", this.ul.id + "_item_" + this.index);

                // scroll to highlighted element in case parent's height is fixed
                this.ul.scrollTop = lis[i].offsetTop - this.ul.clientHeight + lis[i].clientHeight;

                $.fire(this.address_input, "postcoder-complete-highlight", {
                    text: this.suggestions[this.index]
                });
            }
        },

        select: function(selected, origin) {
            if (selected) {
                this.index = $.siblingIndex(selected);
            } else {
                selected = this.ul.children[this.index];
            }

            if (selected) {
                var suggestion = this.suggestions[this.index];

                if(suggestion.type != "ADD") {

                    update_filter (this, suggestion.value, true, suggestion.label, this.address_input.value.trim() + " ");

                } else {

                    var allowed = $.fire(this.address_input, "postcoder-complete-select", {
                        text: suggestion,
                        origin: origin || selected
                    });

                    if (allowed) {
                        this.close({
                            reason: "select"
                        });

                        // Build the request to the retrieve endpoint to get the full address
                        var req_retrieve_url = this.retrieve_url
                                + "?apikey=" + this.apiKey
                                + "&Country=" + this.country
                                + "&query=" + encodeURIComponent(this.address_input.value.trim())
                                + "&id=" + encodeURIComponent(suggestion.value)
                                + "&lines=" + this.addresslines
                                + "&exclude=" + this.excludeFields
                                + "&identifier=" + this.identifier;

                        var request = new XMLHttpRequest();

                        request.open('GET', req_retrieve_url, true);

                        var that = this;

                        request.onload = function() {
                            if (request.status >= 200 && request.status < 400) {

                                var data = JSON.parse(request.responseText);

                                $.fire(that.address_input, "postcoder-complete-selectcomplete", {
                                    text: suggestion,
                                    address: data[0],
                                    country: that.country
                                });

                                that.status.textContent = that.languageObject.address_selected;

                                that.previousFilters = [];
                                update_filter(that, "", false);
                                update_header(that, "", false);


                            } else {

                                update_header(that, that.languageObject.address_api_error, true);
                                that.status.textContent = that.languageObject.address_api_error;

                            }
                        };

                        request.onerror = function() {

                            update_header(that, that.languageObject.connection_error, true);
                            that.status.textContent = that.languageObject.connection_error;

                        };

                        request.send();
                    }

                }
            }
        },

        address_evaluate: function() {

            var me = this;
            var value = this.address_input.value.trim();

            if (value.length >= this.minChars && this._list.length > 0) {

                this.index = -1;
                // Populate list with options that match
                this.ul.innerHTML = "";

                this.suggestions = this._list
                        .map(function(item) {
                            return new Suggestion(item);
                        });

                this.suggestions = this.suggestions.slice(0, this.maxItems);

                this.suggestions.forEach(function(text, index) {

                    // Build count text
                    var count_display = text.count.toLocaleString();

                    if(text.count > 100 && me.showFullCounts === false) {
                        count_display = "100+";
                    }

                    // Choose icon
                    var icon = me.iconHtml.collection +'<span class="sr-only">'+me.languageObject.address_collection+'</span> ';

                    if (text.type == "ADD") {
                        icon = me.iconHtml.address +'<span class="sr-only">'+me.languageObject.address+'</span> ';
                    }

                    // Build suggestion text
                    var final_text = "";

                    if(text.label == '') {
                        final_text = addHighlight(value, text.location);
                    } else {
                        final_text = addHighlight(value, text.label);

                        if(text.location != '') {
                            final_text = final_text + " <span class='location'>" + addHighlight(value, text.location) + "</span>";
                        }
                    }

                    // Piece together the bits
                    var address_label_html = icon + final_text;

                    if (text.type != "ADD") {
                        address_label_html = address_label_html + " <span class='count'>("+count_display+" "+me.languageObject.address_plural+")</span>";
                    }

                    // Build the final list item

                    var child  = $.create("li", {
                        innerHTML: address_label_html,
                        "class": text.type,
                        "aria-selected": "false",
                        "id": "postcoder_complete_list_" + AlliesComplete.numInstances + "_item_" + index
                    });

                    me.ul.appendChild(child);
                });

                if (this.ul.children.length === 0) {

                    this.status.textContent = this.languageObject.address_not_found;

                    update_header(this, this.languageObject.address_not_found, true);

                    this.ul.innerHTML = "";

                    this.close({
                        reason: "nomatches"
                    });

                } else {
                    this.open();

                    update_header(this, "", false);

                    var total_results = 0;
                    for (var i = 0; i < this._list.length; i++) {
                        total_results += this._list[i].count;
                    }

                    if (total_results === 1) {

                        this.status.textContent = "1 " + this.languageObject.result_found;

                    } else {

                        this.status.textContent = this.ul.children.length + " " + this.languageObject.result_found_plural;

                    }
                }
            } else {

                this.status.textContent = this.languageObject.address_not_found;

                update_header(this,  this.languageObject.address_not_found, true);

                this.ul.innerHTML = "";
            }
        },
    };

    // Static methods/properties

    _.all = [];

    // Private functions

    function Suggestion(data) {

        var o = Array.isArray(data) ?
                {
                    label: data[0],
                    value: data[1]
                } :
                typeof data === "object" && "label" in data && "value" in data && "location" in data && "type" in data && "count" in data ? data : {
                    label: data,
                    value: data,
                    location: data,
                    type: data,
                    count: data
                };

        this.label = o.label || o.value;
        this.value = o.value;
        this.location = o.location || "";
        this.type = o.type || "";
        this.count = o.count || 1;
    }
    Object.defineProperty(Suggestion.prototype = Object.create(String.prototype), "length", {
        get: function() {
            return this.label.length;
        }
    });
    Suggestion.prototype.toString = Suggestion.prototype.valueOf = function() {
        return "" + this.label;
    };

    function configure(instance, properties, o) {
        for (var i in properties) {
            var initial = properties[i],
                    attrValue = instance.address_input.getAttribute("data-" + i.toLowerCase());

            if (typeof initial === "number") {
                instance[i] = parseInt(attrValue);
            } else if (initial === false) { // Boolean options must be false by default anyway
                instance[i] = attrValue !== null;
            } else if (initial instanceof Function) {
                instance[i] = null;
            } else {
                instance[i] = attrValue;
            }

            if (!instance[i] && instance[i] !== 0) {
                instance[i] = (i in o) ? o[i] : initial;
            }
        }
    }

    function update_header (instance, message, show_header) {

        if(show_header === true) {

            instance.header.removeAttribute("hidden");

            instance.headerText.textContent = message;

            if (message == "") {
                instance.headerIcon.innerHTML = instance.iconHtml.back + '<span class="sr-only">'+ instance.languageObject.filter+'</span> ';
                instance.currentPathFilter.removeAttribute("hidden");
                instance.header.setAttribute("title", instance.languageObject.filter_remove);
                instance.header.classList.remove("error");
                instance.header.classList.add("filter");
            } else {
                instance.headerIcon.innerHTML = instance.iconHtml.error + '<span class="sr-only">'+ instance.languageObject.error+'</span> ';
                instance.currentPathFilter.setAttribute("hidden", "");
                instance.header.removeAttribute("title");
                instance.header.classList.add("error");
                instance.header.classList.remove("filter");
            }

        } else {

            instance.header.setAttribute("hidden", "");
            instance.headerIcon.innerHTML = "";

        }

    }

    function addHighlight(search, string) {

        if(search.trim() != '') {

            var search_regex = search.trim().split(" ").map($.regExpEscape).join('|');

            return string.replace(RegExp(search_regex, "gi"), "<mark>$&</mark>").replace(RegExp($.regExpEscape("</mark> <mark>"), "gi"), " ");

        } else {
            return string
        }
    }

    function update_filter (instance, filter, search_again, label_text, search_term) {

        label_text = label_text || "";
        search_term = search_term || "";
        search_again = search_again || false;

        if (label_text != "") {
            label_text = $.shortenLabel(label_text);
        }

        // Make note of what was searched when we started filtering - used to know at what point to abandon the filter if the input text is deleted
        if (instance.currentPathFilter.getAttribute("data-that-generated-filter") === "") {
            instance.currentPathFilter.setAttribute("data-that-generated-filter", search_term);
        }

        instance.currentPathFilter.textContent = label_text;
        instance.currentPathFilter.setAttribute("data-filter", filter);
        instance.currentPathFilter.setAttribute("data-search-term", search_term);

        if(filter === "" && instance.previousFilters.length <= 1) {
            // If function hasn't been passed a new filter, and there isn't one to go back to
            instance.currentPathFilter.setAttribute("hidden", "");
            if(instance.address_input.value.substr(-1,1) == " ") {
                instance.address_input.value = instance.address_input.value.trim();
            }

            // Make sure the array is empty ready for future filtering
            instance.previousFilters = [];

        } else if (filter === "" && instance.previousFilters.length > 1) {
            // If function hasn't been passed a new filter, and there is one to go back to

            // Then get the last filter in the array out and use the next one to overwrite current filter
            instance.previousFilters.pop();

            instance.currentPathFilter.textContent = instance.previousFilters[instance.previousFilters.length-1].label_text;

            instance.currentPathFilter.setAttribute("data-filter", instance.previousFilters[instance.previousFilters.length-1].filter);

            instance.currentPathFilter.setAttribute("data-search-term", instance.previousFilters[instance.previousFilters.length-1].search_term);

        } else {
            // If function has been passed a new filter

            instance.address_input.value = instance.address_input.value.trim();
            // Show the information for the new filter
            instance.currentPathFilter.removeAttribute("hidden");

            // Store that information in the previousFilters array for future use
            instance.previousFilters.push({ filter: filter, label_text: label_text, search_term: search_term });

        }

        if (search_again === true) {
            browseAddress(instance);
        }

    }

    // Main perform address autocomplete function
    var autocomplete_request = new XMLHttpRequest();
    var req_active = false;

    function browseAddress (instance) {

        var req_find_url = instance.autocomplete_url
                + "?apikey=" + instance.apiKey
                + "&Country=" + instance.country
                + "&identifier=" + instance.identifier
                + "&query=" + encodeURIComponent(instance.address_input.value.trim());

        var path_filter = instance.currentPathFilter.getAttribute("data-filter");

        if (path_filter != "") {

            req_find_url = req_find_url + "&PathFilter=" + encodeURIComponent(path_filter);

        }

        autocomplete_request.open('GET', req_find_url, true);

        autocomplete_request.onload = function () {
            if (autocomplete_request.status >= 200 && autocomplete_request.status < 400) {

                var data = JSON.parse(autocomplete_request.responseText);

                if (data.length > 0) {

                    var ajax_list = [];

                    for (var i = 0; i < data.length; i++) {

                        var item = {
                            label: data[i].summaryline,
                            location: "",
                            value: data[i].id,
                            type: "ADD",
                            count: 1
                        };

                        if(data[i].locationsummary !== false) {
                            if (data[i].summaryline == "") {
                                item.label = data[i].locationsummary;
                            } else {
                                item.location = data[i].locationsummary;
                            }
                            item.type = data[i].type;
                            item.count = data[i].count;
                        }

                        ajax_list.push(item);
                    }

                    instance.list = ajax_list;
                    instance.address_evaluate();

                    if(instance.currentPathFilter.getAttribute("data-filter") != "") {
                        update_header(instance, "", true);
                    } else {
                        update_header(instance, "", false);
                    }


                } else {

                    update_header(instance, instance.languageObject.address_not_found, true);

                    instance.status.textContent = instance.languageObject.address_not_found;

                    instance.ul.innerHTML = "";

                }

            } else {

                update_header(instance, instance.languageObject.address_api_error, true);
                instance.status.textContent = instance.languageObject.address_api_error;

            }
            req_active = false;
        };

        autocomplete_request.onerror = function() {

            update_header(instance, instance.languageObject.connection_error, true);
            instance.status.textContent = instance.languageObject.connection_error;

        };

        if (autocomplete_request.readyState == 1) {
            autocomplete_request.send();
        }
        else {
            autocomplete_request.abort();
        }

        req_active = true;

    }

    // Helpers

    var slice = Array.prototype.slice;

    function $(expr, con) {
        return typeof expr === "string" ? (con || document).querySelector(expr) : expr || null;
    }

    function $$(expr, con) {
        return slice.call((con || document).querySelectorAll(expr));
    }

    $.create = function(tag, o) {
        var element = document.createElement(tag);

        for (var i in o) {
            var val = o[i];
            var ref;

            if (i === "inside") {
                $(val).appendChild(element);
            } else if (i === "around") {
                ref = $(val);
                ref.parentNode.insertBefore(element, ref);
                element.appendChild(ref);
            } else if (i === "after") {
                ref = $(val);
                ref.parentNode.insertBefore(element, ref.nextSibling);
            } else if (i in element) {
                element[i] = val;
            } else {
                element.setAttribute(i, val);
            }
        }

        return element;
    };

    $.bind = function(element, o) {
        if (element) {
            for (var event in o) {
                var callback = o[event];

                event.split(/\s+/).forEach(function(event) {
                    element.addEventListener(event, callback);
                });
            }
        }
    };

    $.unbind = function(element, o) {
        if (element) {
            for (var event in o) {
                var callback = o[event];

                event.split(/\s+/).forEach(function(event) {
                    element.removeEventListener(event, callback);
                });
            }
        }
    };

    $.fire = function(target, type, properties) {
        var evt = document.createEvent("HTMLEvents");

        evt.initEvent(type, true, true);

        for (var j in properties) {
            evt[j] = properties[j];
        }

        return target.dispatchEvent(evt);
    };

    $.regExpEscape = function(s) {
        return s.replace(/[-\\^$*+?.()|[\]{}]/g, "\\$&");
    };

    $.siblingIndex = function(el) {
        /* eslint-disable no-cond-assign */
        for (var i = 0; el = el.previousElementSibling; i++);
        return i;
    };

    $.shortenLabel = function (label_text, mode) {
        mode = mode || "both";
        var label_array;

        if (mode == "right") {
            label_array = label_text.split(",");
            if(label_array.length > 2) {
                return label_array[label_array.length - 2].trim() + ", " + label_array[label_array.length - 1].trim();
            } else {
                return label_array[0].trim();
            }
        } else if (mode == "left") {
            label_array = label_text.split(",");
            if(label_array.length > 2) {
                return label_array[0].trim() + ", " + label_array[1].trim();
            } else {
                return label_array[0].trim();
            }
        } else {
            label_array = label_text.split(",");
            if(label_array.length > 1) {
                return label_array[0].trim() + ", " + label_array[label_array.length - 1].trim();
            } else {
                return label_array[0].trim();
            }
        }
    };

    $.inputFlag = function (element, iso2code) {

        for (var i = 0; i < element.classList.length; ++i) {
            if(/postcoder-flag-.*/.test(element.classList[i])) {
                element.classList.remove(element.classList[i]);
                break;
            }
        }

        element.classList.add("postcoder-flag-" + iso2code.toLowerCase());
    };

    $.isIosDevice = function () {
        if(navigator.userAgent.match(/(iPod|iPhone|iPad)/g) && navigator.userAgent.match(/AppleWebKit/g)) {
            return true;
        } else {
            return false;
        }
    };

    // Initialization

    function init() {
        $$("address_input.postcoder-complete").forEach(function(address_input) {
            new _(address_input);
        });
    }

    // Are we in a browser? Check for Document constructor
    if (typeof Document !== "undefined") {
        // DOM already loaded?
        if (document.readyState !== "loading") {
            init();
        } else {
            // Wait for it
            document.addEventListener("DOMContentLoaded", init);
        }
    }

    _.$ = $;
    _.$$ = $$;

    // Make sure to export AlliesComplete on self when in a browser
    if (typeof self !== "undefined") {
        self.AlliesComplete = _;
    }

    // Expose AlliesComplete as a CJS module
    if (typeof module === "object" && module.exports) {
        module.exports = _;
    }

    return _;

}());
