(function(){
  function ready(fn){ document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', fn, {once:true}) : fn(); }
  function bindProductCustomization(root){
    root = root || document;
    var input = root.querySelector ? root.querySelector('#customImages') : document.getElementById('customImages');
    var list = root.querySelector ? root.querySelector('#customImageList') : document.getElementById('customImageList');
    if(input && list){
      input.addEventListener('change', function(){
        list.innerHTML = '';
        Array.prototype.slice.call(input.files || [], 0, 8).forEach(function(file){
          var pill = document.createElement('span');
          pill.className = 'pc-image-pill';
          var img = document.createElement('img');
          img.alt = '';
          img.src = URL.createObjectURL(file);
          img.onload = function(){ URL.revokeObjectURL(img.src); };
          var name = document.createElement('span');
          name.textContent = file.name;
          pill.appendChild(img);
          pill.appendChild(name);
          list.appendChild(pill);
        });
      });
    }
  }
  ready(function(){
    bindProductCustomization(document);
    window.getProductCustomizationSummary = function(){
      var notes = (document.getElementById('customNotes') || {}).value || '';
      var input = document.getElementById('customImages');
      var files = input && input.files ? Array.prototype.slice.call(input.files).map(function(file){ return file.name; }) : [];
      var lines = [];
      if(notes.trim()) lines.push('ملاحظات التخصيص: ' + notes.trim());
      if(files.length) lines.push('صور التخصيص: ' + files.join('، '));
      return lines;
    };
    window.getProductCustomizationFiles = function(){
      var input = document.getElementById('customImages');
      return input && input.files ? Array.prototype.slice.call(input.files, 0, 8) : [];
    };
    window.initProductCustomization = bindProductCustomization;
  });
})();
