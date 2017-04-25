var unirest = require('unirest');
var express = require('express');
var events = require('events');

var getFromApi = function(endpoint, args) {
    var emitter = new events.EventEmitter();
    unirest.get('https://api.spotify.com/v1/' + endpoint)
        .qs(args)
        .end(function(response) {
            if (response.ok) {
                emitter.emit('end', response.body);
            }
            else {
                emitter.emit('error', response.code);
            }
        });
    return emitter;
};

var app = express();
app.use(express.static('public'));

app.get('/search/:name', function(req, res) {
    var searchReq = getFromApi('search', {
        q: req.params.name,
        limit: 1,
        type: 'artist'
    });

    searchReq.on('end', function(item) {
        var artist = item.artists.items[0];
        var id = artist.id;

        var relatedArtistsReq = getFromApi('artists/' + id + '/related-artists');

        relatedArtistsReq.on('end', function(relatedArtists) {
            artist.related = relatedArtists.artists;
            
            var completedRelatedArtists = 0;

            var checkComplete = function() {
                if (++completedRelatedArtists === relatedArtists.artists.length) {
                    res.json(artist);
                }
            };

            relatedArtists.artists.forEach(function(relatedArtist, idx) {
                var topTracksReq = getFromApi('artists/' + relatedArtist.id + '/top-tracks', {
                    country: 'US'
                });

                topTracksReq.on('end', function(topTracks) {
                    artist.related[idx].tracks = topTracks.tracks;
                    checkComplete();
                });

                topTracksReq.on('error', function(code) {
                    checkComplete();
                });
            });


        });
    });

    searchReq.on('error', function(code) {
        res.sendStatus(code);
    });
});

app.listen(process.env.PORT || 8080);
