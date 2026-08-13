(function(){
  if(document.getElementById('bariq-entity-jsonld'))return;
  function add(data,id){
    var s=document.createElement('script');
    s.type='application/ld+json';
    if(id)s.id=id;
    s.textContent=JSON.stringify(data);
    document.head.appendChild(s);
  }
  add({
    '@context':'https://schema.org',
    '@type':'LocalBusiness',
    name:'\u0628\u0631\u064a\u0642 \u0644\u0644\u0647\u062f\u0627\u064a\u0627 \u0648\u0627\u0644\u0625\u0628\u062f\u0627\u0639',
    alternateName:[
      '\u0628\u0631\u064a\u0642',
      '\u0628\u0631\u064a\u0642 \u0644\u0644\u0647\u062f\u0627\u064a\u0627',
      'Bariq',
      'Bariq Gifts',
      'Bariq Gifts UAE'
    ],
    url:'https://bariqgifts.com/',
    logo:'https://bariqgifts.com/assets/logo.png',
    image:'https://bariqgifts.com/assets/logo.png',
    telephone:'+971554423151',
    email:'bariq.gifts@gmail.com',
    address:{
      '@type':'PostalAddress',
      addressLocality:'Ras Al Khaimah',
      addressRegion:'Ras Al Khaimah',
      addressCountry:'AE'
    },
    areaServed:{'@type':'Country',name:'United Arab Emirates'},
    openingHoursSpecification:[{
      '@type':'OpeningHoursSpecification',
      dayOfWeek:['Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday'],
      opens:'09:00',
      closes:'19:00'
    }],
    sameAs:[
      'https://www.instagram.com/bariq.gifts/',
      'https://www.facebook.com/bariq.gifts'
    ],
    description:'\u0628\u0631\u064a\u0642 \u0644\u0644\u0647\u062f\u0627\u064a\u0627 \u0645\u062a\u062c\u0631 \u0647\u062f\u0627\u064a\u0627 \u0645\u062e\u0635\u0635\u0629 \u0644\u0644\u0645\u0646\u0627\u0633\u0628\u0627\u062a \u0641\u064a \u0627\u0644\u0625\u0645\u0627\u0631\u0627\u062a\u060c \u064a\u062e\u062f\u0645 \u062c\u0645\u064a\u0639 \u0645\u0646\u0627\u0637\u0642 \u0627\u0644\u0625\u0645\u0627\u0631\u0627\u062a \u0648\u0644\u062f\u064a\u0647 \u0645\u0635\u0646\u0639 \u0641\u064a \u0631\u0623\u0633 \u0627\u0644\u062e\u064a\u0645\u0629 \u0644\u062a\u0635\u0645\u064a\u0645 \u0648\u062a\u0646\u0641\u064a\u0630 \u0637\u0644\u0628\u0627\u062a \u0627\u0644\u0647\u062f\u0627\u064a\u0627 \u062d\u0633\u0628 \u0637\u0644\u0628 \u0627\u0644\u0639\u0645\u064a\u0644.'
  },'bariq-entity-jsonld');
  add({
    '@context':'https://schema.org',
    '@type':'WebSite',
    name:'\u0628\u0631\u064a\u0642',
    alternateName:['Bariq Gifts','\u0628\u0631\u064a\u0642 \u0644\u0644\u0647\u062f\u0627\u064a\u0627 \u0648\u0627\u0644\u0625\u0628\u062f\u0627\u0639'],
    url:'https://bariqgifts.com/',
    potentialAction:{
      '@type':'SearchAction',
      target:'https://bariqgifts.com/categories?q={search_term_string}',
      'query-input':'required name=search_term_string'
    }
  },'bariq-website-jsonld');
})();
