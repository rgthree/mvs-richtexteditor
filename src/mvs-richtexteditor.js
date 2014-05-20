/**
 * The basic inline text editor.
 * @module
 */
function(window){

  "use strict";

  MooVeeStar.templates.register('color-chooser', '<section class="color-chooser"><ul></ul></section>');

  var ColorChooser = new Class({
    Extends: MooVeeStar.View,

    events: {
      'window:click':'onWindowClick'
    },

    options: {
      destroyOnChoose:true
    },

    template: 'color-chooser',

    render: function(){
      var list = this.element.getFirst().empty();
      var colors = [
        ['#000000', '#434343', '#656565', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#FFFFFF'],
        ['#b40000', '#ff0000', '#ff9000', '#ffff00', '#00ff00', '#00ffff', '#0086ea', '#0e00ff', '#b600ff', '#ff00ff'],
        ['#f8b5af', '#ffc9cc', '#ffe4cc', '#fff2cb', '#d1ecd3', '#c8e0e3', '#c1daf9', '#c6e3f4', '#dcd1ea', '#f4cfdc'],
        ['#fa7569', '#ff9298', '#ff9298', '#ffe597', '#a4d9a7', '#90c6ca', '#94c3f5', '#89c6e9', '#baa5d7', '#e6a1bd'],
        ['#ee241e', '#ff5664', '#ffad67', '#ffd760', '#74c87c', '#56a7b0', '#4a9eec', '#42a9dd', '#9579c4', '#d973a0'],
        ['#c30000', '#f10000', '#ff8b30', '#ffc023', '#31ac4c', '#00838f', '#0078d9', '#0087c7', '#7149a8', '#bf4179'],
        ['#9c0105', '#b50000', '#cd5600', '#d08e00', '#007a19', '#00515d', '#0053ce', '#005495', '#3e1477', '#890047'],
        ['#6c0000', '#7a0000', '#893900', '#8a5e00', '#005111', '#00363e', '#004588', '#003864', '#250d4e', '#5a022f']
      ];
      colors.forEach(function(rowColors){
        var row = new Element('li').inject(list);
        rowColors.forEach(function(color){
          row.grab(new Element('button[data-color="'+color+'"][style="background-color:'+color+';"]'));
        });
      });
    },

    onWindowClick: function(e){
      if(!e.target.getSelfOrParent('.color-chooser')){
        this.destroy();
        e.stop();
      }else{
        var color = e.target.get('data-color');
        color && this.fireEvent('choose', { color:color });
        if(this.options.destroyOnChoose)
          this.destroy();
      }
    }

  });



  var RichTextEditor = window.RichTextEditor = {};

  RichTextEditor.AddLinkPopup = new Class({
    Extends: MooVeeStar.View,
    template:'inline-editable-note-add-link-popup',
    events: {
      'click:relay(button[data-format])':'onDataFormatClick',
      'model:change':'render',
      'click:relay([data-action])':'onActionClick',
      'keydown:relay(input)':'onKeyDown'
    },
    initialize: function(object, options){
      var self = this;

      var model = new Class({
        Extends: MooVeeStar.Model,
        properties: {
          href: {
            sanitize: function(v){
              v = (v||'').trim();
              if(v && v.indexOf('http') !== 0)
                v = 'http://'+v;
              return v;
            }
          },          
          text: {
            // If the text is being set to the href, set it to empty
            // The view handles that display
            sanitize: function(v){
              return v === this.get('href') ? '' : v;
            }
          }
        }
      });


      self.parent(new model(object || {}), options);
    },

    render: function(e){
      var self = this;
      this.parent();
      this.element.removeClassesWithPrefix('-edit-').addClass('-edit-'+(!!this.model.get('edit')).toString());
      if(this.model.get('edit'))
        (function(){ self.element.getElement('input:not([disabled])').focus(); }).delay(10);
    },

    onActionClick: function(e, target){
      this.takeAction(target.get('data-action'));
    },

    onKeyDown: function(e){
      if(e.key === 'enter'){
        this.takeAction('apply');
        e.stop();
      }else if(e.key === 'esc'){
        this.takeAction('cancel');
        e.stop();
      }
    },

    takeAction: function(action){
      if(action === 'edit'){
        this.model.set('edit', true);
      }else if(action === 'cancel'){
        this.model.set('edit', false);
      }else if(action === 'apply'){
        this.model.set({
          edit: false,
          text: this.element.getElement('input[data-bind*="text"]').get('value').trim(),
          href: this.element.getElement('input[data-bind*="href"]').get('value').trim()
        });
        // If we removed the href, then set action to remove:
        action = this.model.get('href') ? 'apply' : 'remove';
      }
      this.fireEvent(action, this.model.toJSON());
    }
  });


  RichTextEditor.View = new Class({
    Extends: MooVeeStar.View,

    events: {
      'focus:relay(article[contenteditable])':'onTextAreaFocus',
      'blur:relay(article[contenteditable])':'onTextAreaBlur',
      'click:relay(article[contenteditable])':'onTextAreaClick',
      'keydown:relay(article[contenteditable])':'onTextAreaKeyDown',
      'input:relay(article[contenteditable])':'onTextAreaInput',
      'paste:relay(article[contenteditable])':'onTextAreaPaste',
      'keyup:relay(article[contenteditable])':'onUserActionUp',
      'mouseup:relay(article[contenteditable])':'onUserActionUp',
      'click:relay(nav.menu button[data-command])':'onNavButtonClick'
      // Modernizr._transitionend+':relay(article[contenteditable])' gets added in intialize (dynamic)
    },

    options: {
      autorender:false,
      tabIndent: true,  // If true, we will always stop tab and execute an dindent/outdent
      value: null,      // The initial html value
      saveDelay: 2000,  // ms to wait after keypress stops to save
      showMenu: false,  // Show the menu initially
      initialCommands: {
        insertBrOnReturn: true,   // Isn't widely supported, but might as well set it
        styleWithCSS: false,
        enableObjectResizing: false
      },
      commands: [
        {
          command: 'bold',
          label: 'Bold',
          keys: 'ctrl+b'
        },
        {
          command: 'italic',
          label: 'Italic',
          keys: 'ctrl+i'
        },
        {
          command: 'underline',
          label: 'Underline',
          keys: 'ctrl+u'
        },
        {
          command: 'createLink',
          label: 'Create Link',
          keys: 'ctrl+k'
        },
        /*
        {
          command: 'strikeThrough',
          label: 'Strikethrough',
          keys: 'alt+shift+5'
        },
        {
          command: 'justifyLeft',
          label: 'Align Left',
          keys: 'ctrl+shift+l'
        },
        {
          command: 'justifyCenter',
          label: 'Align Center',
          keys: 'ctrl+shift+e'
        },
        {
          command: 'justifyRight',
          label: 'Align Right',
          keys: 'ctrl+shift+r'
        },
        {
          command: 'justifyFull',
          label: 'Justify',
          keys: 'ctrl+shift+j'
        },
        */
        {
          command: 'insertOrderedList',
          label: 'Numbered List',
          keys: 'ctrl+shift+7'
        },
        {
          command: 'insertUnorderedList',
          label: 'Bullet List',
          keys: 'ctrl+shift+8'
        },
        /*
        {
          command: 'indent',
          label: 'Increase Indent'
        },
        {
          command: 'outdent',
          label: 'Decrease Indent'
        },
        {
          command: 'foreColor',
          label: 'Text Color'
        },
        {
          command: 'hiliteColor',
          label: 'Text Background Color'
        },
        {
          command: 'removeFormat',
          label: 'Clear Formatting'
        },
        */
        {
          command: 'fullscreen',
          button: false,
          keys: 'ctrl+f'
        },
        {
          command: 'save',
          button: false,
          keys: 'ctrl+s'
        },
        {
          command: 'menu',
          button: false,
          keys: 'ctrl+m'
        }
      ]
    },

    initialize: function(options){
      // Because transitionend is dynamic per browser, add it to the events now
      if(Modernizr._transitionend)
        this.events[Modernizr._transitionend+':relay(article[contenteditable])'] = 'onTextAreaTransitionEnd';

      var self = this;
      self.element = new Element('section.editor');
      self.parent(null, options);
      self.options.commands = self.options.commands || [];
      self.options.keys = self.options.keys || {};

      self.elements.menu = new Element('nav.menu').grab(new Element('ul')).inject(this.element);
      self.toggleMenu(this.options.showMenu);
      
      // Build Maps to use
      self.keys = {};     // Shortcut Keys
      self.commands = {}; // A map of Commands for quick lookup
      self.options.commands.forEach(function(cmd){
        self.keys[cmd.keys] = cmd;
        self.commands[cmd.command] = cmd;
        var keysText = (cmd.keys || '').toUpperCase();
        if(keysText){
          keysText = keysText.replace('SHIFT', '⇧')
          if(Browser.Platform.mac)
            keysText = keysText.replace('CTRL', '⌘').replace('ALT', '⌥').replace(/\++/g,'');
          else
            keysText = keysText.replace('CTRL', 'Ctrl').replace('ALT', 'Alt');
          keysText = ' ('+keysText+')';
        }
        var btn = new Element('button[tabindex="-1"][text="'+cmd.label+'"][data-command="'+cmd.command+'"][data-tooltip="'+cmd.label+keysText+'"]');
        cmd.button !== false && self.elements.menu.getFirst().grab(new Element('li[data-for="'+cmd.command+'"]').grab(btn));
        if(cmd.command === 'foreColor' || cmd.command === 'hiliteColor'){
          btn.grab(new Element('span.color'));
        }
      });

      self.elements.textarea = new Element('article[contenteditable]').inject(this.element);
      if(this.options.value)
        self.setHtml(this.options.value);

      this.render.delay(1, this);
    },

    render: function(){
      var self = this;
      self.elements.menu.getElements('button[data-command]').forEach(function(button){
        try {
          var color, command = button.get('data-command');
          if(command === 'foreColor' || command === 'hiliteColor'){
            color = document.queryCommandValue(command) || document.queryCommandValue(command) || (command === 'hiliteColor' && document.queryCommandValue('backColor')) || '';
            button.getElement('span.color').setStyle('background-color', color);
          }else{
            var on = document.queryCommandState(command);
            button.toggleClass('-on', on === "true" || on === true ? true : false);
          }
        }catch(e){}
      });

      // Check to see if we're in an anchor      
      var a;
      if(a = self.getSelectionParentTag(['a'])){
        var modelText = a.get('text') !== a.get('href') ? a.get('text') : '';
        if(self.selectedAnchorPopup){
          self.selectedAnchorPopup.model.set({ text:modelText, href:a.get('href') });
        }else{
          self.selectedAnchorPopup = new RichTextEditor.AddLinkPopup(
            { text:modelText, href:a.get('href'), edit:!a.get('href') || a.get('href') === 'http://' },
            {
              onApply: function(e){
                a.set({ text:e.text || e.href, href:e.href });
                self.restoreSelection();
              },
              onRemove: function(e){
                new Element('span[text="'+e.text+'"]').replaces(a);
                self.restoreSelection().render();
              }
            }
          );
        }
        var coords = a.getCoordinates(self.element);
        self.element.grab($(self.selectedAnchorPopup).setStyles({ top:coords.top + coords.height, left:coords.left, 'z-index':99999 }));
      }else{
        self.removeSelectedAnchorPopup();
      }
    },

    // Remove the selected Anchor popup only if it does not contain the activeElement
    removeSelectedAnchorPopup: function(){
      if(this.selectedAnchorPopup && (!document.activeElement || !document.activeElement.getSelfOrParent('[data-tpl="'+$(this.selectedAnchorPopup).get('data-tpl')+'"]'))){
        this.selectedAnchorPopup.destroy();
        this.selectedAnchorPopup = null;
      }
    },

    toggleMenu: function(bool){
      var toShow = bool != null ? bool : !this.element.hasClass('-show-menu');
      if((toShow && !this.element.hasClass('-show-menu')) || (!toShow && this.element.hasClass('-show-menu'))){
        this.element.toggleClass('-show-menu', toShow);
        Modernizr._transitionend &&  this.element.addClass('-animating');
        this.fireEvent((toShow ? 'show':'hide')+'-menu', {});
      }
    },

    // https://developer.mozilla.org/en-US/docs/Rich-Text_Editing_in_Mozilla#Executing%5FCommands
    execute: function(command, value, force){
      // If we got indent or outdent, cehck to see if we're in an ou/ul/li
      // otherwise change command to insert bullet
      if(command === 'indent' && this.commands[command] && !this.getSelectionParentTag(['li','ul','ol']))
        command = 'insertUnorderedList';

      if(command === 'menu'){
        this.toggleMenu();
      }else if(command === 'removeFormat' && !document.queryCommandEnabled(command)){
        // No select, remove from entire doc and move cursor to beginning
        document.execCommand('selectAll', false);
        document.execCommand(command, false);
        document.getSelection().collapseToStart();
      }else if(command === 'createLink'){
        this.restoreSelection();
        // IE seems to do it's own thing with it's own popup when creating a link. Just let it.
        if(Browser.ie)
          document.execCommand(command);
        else
          document.execCommand(command, false, value || 'http://');
      }else if(command !== 'save'){
        if(command && (this.commands[command] || force === true)){
          try {
            // We may get in here with an unsupported (or even fake) command. FireFox (sometime before v22) doesn't
            // support queryCommandSupported, and IE doesn't seem to catch the error (and breaks). Therefore, only
            // execute the command if it's supported or we're no queryCommandSupported (for FireFox sometime before v22)
            if(!document.queryCommandSupported || document.queryCommandSupported(command))
              document.execCommand(command, false, value || '');
          }catch(e){
            // So dumb, but FF sucks major browser balls: lists, in particular, don't
            // work on a single line or if all content is selected.
            // If the command fails and we get the error result from FF, then try
            // to insert something else so we're not the only line AND not truly selected all
            // Some fixes say use a <br> but that didn't seem to work 100% of the time, so I used a <span> w/ text content
            // Filed https://bugzilla.mozilla.org/show_bug.cgi?id=900644
            if(e && e.result == 2147500037){
              var fix = new Element('span[text="."]').inject(this.elements.textarea);
              document.execCommand(command, false, value || '');
              fix.destroy();
            }else{
              throw e;
            }
          }
        }          
      }
      this.fireEvent(command);
      this.fireEvent('command', { command:command});
      this.render.delay(1, this);
    },

    setHtml: function(html){
      this.elements.textarea.set('html', html);
      return this;
    },

    getHtml: function(){
      return this.elements.textarea.get('html');
    },

    getText: function(){
      return this.elements.textarea.get('text');
    },
    
    focus: function(){
      if(document.activeElement !== this.elements.textarea)
        this.elements.textarea.focus();
      // Only restore selection when we explicitly call focus
      this.restoreSelection();
      return this;
    },

    blur: function(){
      this.elements.textarea.blur();
      return this;
    },

    // This will fire when the textarea stops a transition
    // Because it's position changed, we'll want to check if we should popup 
    // the selected anchor again
    onTextAreaTransitionEnd: function(e){
      this.render();
      this.element.removeClass('-animating');
    },

    onTextAreaFocus: function(e){
      this.fireEvent('focus');
    },

    onTextAreaBlur:function(e){
      var self = this;
      self.saveSelection();

      // Because we may blur by clicking on the "change" link of the anchor popup, we'll wait a sec
      // and check to see if the activeElement's focus is within that popup. Otherwise, remove it.
      clearTimeout(self.destroyAnchorPopupTimout);
      self.destroyAnchorPopupTimout = self.removeSelectedAnchorPopup.delay(100, self);
      self.fireEvent('blur');
    },

    onTextAreaClick: function(e){
      if(e.target.getSelfOrParent('a[href]'))
        e.preventDefault();
      this.render();
    },

    // We need to do some fixes that we can check whenever the user is done
    // interacting with the note, such as keyup and mouseup
    onUserActionUp: function(){
      // On new notes, the selection doesn't save correctly
      // on a blur, so let's save more often
      this.saveSelection();

      // If we have never triggered an input event, call it manually here (IE doesn't support it)
      this.onTextAreaInput();
    },

    saveSelection: function(){
      var sel;
      sel = window.getSelection();
      if(sel.getRangeAt && sel.rangeCount){
        this.savedRange = sel.getRangeAt(0).cloneRange();
      }
      return this;
    },

    restoreSelection: function(){
      var sel;
      if(this.savedRange){
        sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(this.savedRange);
      }
      return this;
    },

    deleteSelection: function(selection){
      var sel, range;
      sel = selection || window.getSelection();
      range = sel.getRangeAt(0);
      range.deleteContents();
      return this;
    },

    getSelectionParentTag: function(tagNames){
      var sel, rgx, matched, currentNode;
      tagNames = [tagNames].flatten();
      rgx = new RegExp('^('+tagNames.join('|')+')$', 'i');
      matched = null;
      sel = window.getSelection();
      currentNode = sel.anchorNode;
      if(currentNode && currentNode !== this.elements.textarea){
        do{
          if(currentNode && currentNode.nodeType === 1 && rgx.test(currentNode.nodeName))
            matched = currentNode;
          else
            currentNode = currentNode.parentNode;
        }while(matched === null && currentNode && currentNode !== this.elements.textarea);
      }
      return matched;
    },

    onTextAreaKeyDown: function(e){
      var self, keys, sel, range;
      self = this;
      keys = e.key;
      // We typed a space and we're not in an anchor, check before the cursor to see if we just typed a web address
      if((e.key === 'space' || e.key === 'enter') && !this.getSelectionParentTag('a')){
        sel = window.getSelection();
        if(sel.anchorNode && sel.anchorNode.nodeType === 3 && sel.anchorNode.nodeValue){
          var text, trailing, fragContents, anchor;
          text = sel.anchorNode.nodeValue.substr(0, sel.anchorOffset);
          text = String(text || '').split(' ');
          text = text[text.length-1].trim();  // Sometimes that split maintains a space... not sure what's up with that.
          trailing =/[.,\?\!\:\;]*$/.exec(text);
          trailing = trailing && trailing.length && trailing[0] || '';
          if(text && text.length && !/\s+$/.test(text) && /^https?:\/\//.test(text)){
            range = sel.getRangeAt(0);
            range.setStart(sel.anchorNode, sel.anchorOffset - text.length);
            range.setEnd(sel.anchorNode, sel.anchorOffset - trailing.length);
            anchor = new Element('a[href="'+range.cloneContents().firstChild.nodeValue+'"]');
            range.surroundContents(anchor);
            // Set the selection to the end of the anchor plus any trailing length we had
            range.setStart(anchor.nextSibling, trailing.length);
            range.setEnd(anchor.nextSibling, trailing.length);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
          }
        }
      }

      if(/up|down|right|left|delete|backspace/.test(e.key) || e.code === 36 || e.code === 35 || e.code === 33 || e.code === 34){
        this.render.delay(1, this);
      }else if(e.key === 'tab' && this.options.tabIndent){
        self.execute(e.shift ? 'outdent' : 'indent', null);
        e.stop();
      }else{
        if(e.shift)
          keys = 'shift+'+keys;
        if(!!(Browser.Platform.mac ? e.meta : e.control))
          keys = 'ctrl+'+keys;
        if(e.alt)
          keys = 'alt+'+keys;

        if(self.keys[keys]){
          self.execute(self.keys[keys].command);
          e.stop();
        }
        if(keys.contains('+') || keys === 'esc'){
          self.fireEvent(keys, e);
        }
      }
    },

    // On input of the textarea
    // IE doesn't support 'input' on a contenteditable, so it will actually call this from keyup
    // if we haven't ever triggered this from a user action up
    onTextAreaInput: function(e){
      var self = this;
      if(e && e.type === 'input' && !this.supportsInputEvent)
        this.supportsInputEvent = true;

      // If we specified a saveDelay, then execute a save command when the user
      // has stopped typing for that amount of time
      if(self.options.saveDelay != null){
        clearTimeout(self.keydownSaveTimeout);
        self.keydownSaveTimeout = (function(){
          self.execute('save');
        }).delay(Number(self.options.saveDelay));
      }
      self.execute('input', e);
    },

    onTextAreaPaste: function(e){
      var self = this;
      self.fireEvent('paste', e);
      (function(){
        self.fireEvent('paste-done', e);
      }).delay(0);
    },

    onNavButtonClick: function(e, target){
      var self, command;
      self = this;
      self.restoreSelection();
      command = target.get('data-command');
      if(command === 'foreColor' || command === 'hiliteColor'){
        (function(){
          var chooser, coords;
          chooser = new ColorChooser();
          chooser.addEvent('choose', function(e){
            self.execute(command, e.color);
            chooser.destroy();
          });
          var coords = target.getCoordinates();
          $(chooser).setStyles({ position:'absolute', top: coords.top, left: coords.left });
          $(document.body).grab($(chooser));
        }).delay(1);
      }else{
        self.restoreSelection();
        self.execute(target.get('data-command'));
      }
    },

    destroy: function(){
      clearTimeout(this.keydownSaveTimeout);
      this.parent();
    }

  });

})(window);
