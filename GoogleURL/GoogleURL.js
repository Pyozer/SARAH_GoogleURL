var ScribeSpeak;
var token;
var TIME_ELAPSED;
var FULL_RECO;
var PARTIAL_RECO;
var TIMEOUT_SEC = 10000;

exports.init = function () {
    info('[ GoogleURL ] is initializing ...');
}

exports.action = function(data, callback){
	
	ScribeSpeak = SARAH.ScribeSpeak;

	FULL_RECO = SARAH.context.scribe.FULL_RECO;
	PARTIAL_RECO = SARAH.context.scribe.PARTIAL_RECO;
	TIME_ELAPSED = SARAH.context.scribe.TIME_ELAPSED;

	SARAH.context.scribe.activePlugin('GoogleURL');

	var util = require('util');
	console.log("GoogleURL call log: " + util.inspect(data, { showHidden: true, depth: null }));

	SARAH.context.scribe.hook = function(event) {
		checkScribe(event, data.action, callback); 
	};
	
	token = setTimeout(function(){
		SARAH.context.scribe.hook("TIME_ELAPSED");
	}, TIMEOUT_SEC);

}

function checkScribe(event, action, callback) {

	if (event == FULL_RECO) {
		clearTimeout(token);
		SARAH.context.scribe.hook = undefined;
		// aurait-on trouvé ?
		decodeScribe(SARAH.context.scribe.lastReco, callback);

	} else if(event == TIME_ELAPSED) {
		// timeout !
		SARAH.context.scribe.hook = undefined;
		// aurait-on compris autre chose ?
		if (SARAH.context.scribe.lastPartialConfidence >= 0.7 && SARAH.context.scribe.compteurPartial > SARAH.context.scribe.compteur) {
			decodeScribe(SARAH.context.scribe.lastPartial, callback);
		} else {
			SARAH.context.scribe.activePlugin('Aucun (GoogleURL)');
			//ScribeSpeak("Désolé je n'ai pas compris. Merci de réessayer.", true);
			return callback({ 'tts': "Désolé je n'ai pas compris. Merci de réessayer." });
		}
		
	} else {
		// pas traité
	}
}

function decodeScribe(search, callback) {

	console.log ("Search: " + search);
	var rgxp = /site( de| à| a)? (.+)/i;

	var match = search.match(rgxp);
	if (!match || match.length <= 1){
		SARAH.context.scribe.activePlugin('Aucun (GoogleURL)');
		//ScribeSpeak("Désolé je n'ai pas compris.", true);
		return callback({ 'tts': "Désolé je n'ai pas compris." });
	}
	search = match[2];
	return getUrlWebsite(search, callback);
}

function getUrlWebsite(search, callback) {

	var fs = require("fs");
	var path = require('path');
 	var filePath = __dirname + "/UrlSitesSave.json";
	var file_content;

	file_content = fs.readFileSync(filePath, 'utf8');
	file_content = JSON.parse(file_content);

	// On regarde si on a pas déjà cherché ce site
	if(typeof file_content[search] != 'undefined' && file_content[search] != "") {
		console.log('[ GoogleURL ] Vérifié via la sauvegarde');
		var urlwebsite = file_content[search];

		//ScribeSpeak("Voilà le site de " + search);
		open_chrome_url(urlwebsite); // On ouvre le site via chrome
		callback({ 'tts': "Voilà le site de " + search });
		return;

	} else { // Si il est pas sauvegardé, on le cherche via Google

		var url = "https://www.google.fr/search?q=" + encodeURI(search) + "&btnG=Rechercher&gbv=1";
		console.log('Url Request: ' + url);

		var request = require('request');
		var cheerio = require('cheerio');

		var options = {
			'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/49.0.2623.87 Safari/537.36',
			'Accept-Charset': 'utf-8'
		};
		
		request({ 'uri': url, 'headers': options }, function(error, response, html) {

	    	if (error || response.statusCode != 200) {
	    		//ScribeSpeak("La requête vers Google a échoué. Erreur " + response.statusCode);
				callback({ 'tts': "La requête vers Google a échoué. Erreur " + response.statusCode });
				return;
		    }
	        var $ = cheerio.load(html);

	        var urlwebsite = $('.g .s cite').first().text().trim();

	        if(urlwebsite == "") {
	        	console.log("Impossible de récupérer l'url du site via Google");
	        	//ScribeSpeak("Désolé, je n'ai pas réussi à récupérer d'informations");
				callback({ 'tts': "Désolé, je n'ai pas réussi à récupérer d'informations" });
	        } else {
	        	console.log("Informations: " + urlwebsite);

				// On stock le résultat pour une éventuel prochaine fois
			    file_content[search] = urlwebsite;
		    	chaine = JSON.stringify(file_content, null, '\t');
				fs.writeFile(filePath, chaine, function (err) {
					console.log("[ GoogleURL ] Informations enregistrés");
				});

	        	//ScribeSpeak("Voilà le site de " + search);
	        	open_chrome_url(urlwebsite); // On ouvre le site via chrome
				callback({ 'tts': "Voilà le site de " + search });
	        }
		    return;
	    });
	}
}

// Permet d'ouvrir chrome a l'adresse indiqué
function open_chrome_url(url) {
    var exec = require('child_process').exec;
    var config = Config.modules.GoogleURL;
    var navigateur = config.navigateur;
    if(navigateur == "chrome" || navigateur == "firefox" || navigateur == "opera") {
    	var process = 'start ' + navigateur + ' ' + url;
    } else {
    	var process = 'start chrome ' + url;
    }
    
    var child = exec(process);
    return;
}