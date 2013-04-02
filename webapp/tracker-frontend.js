// "use strict";

var imgpri;
var imgsec;
var lastDestX = 110;
var lastDestY = 35;
var lastSigBar = 10;
var barTest = 0; /* test bar signal images */
var sigbar_image = new Array(5);
var aprsDebugWin = $('#aprsdebugwin');

/**
 * Add message to Debug window 2
 */
function addDebug(message) {
        // maximum number of APRS message to display in content DIV
        var maxDebugItems = 100;

        var n = $("#aprsdebugwin").children().length;
        var dt = new Date();
        aprsDebugWin.append('<div class="item">' +
                             (dt.getHours() < 10 ? '0' + dt.getHours() : dt.getHours()) + ':'
                             + (dt.getMinutes() < 10 ? '0' + dt.getMinutes() : dt.getMinutes())
                             + ': ' + message + '</div>');

        aprsDebugWin.scrollTop(aprsDebugWin[0].scrollHeight);

        if (n > maxDebugItems) {
                $("#aprsdebugwin").children("div:first").remove()
        }
}

function display_sigbars(sigvalue, imgobj) {

        lastSigBar = sigvalue;

        var can = document.getElementById('gpswin2');
        var ctx = can.getContext('2d');

        var sourceX = 0;
        var sourceY = 0;
        var sourceWidth = 80;
        var sourceHeight = 80;

        var destX = 110; //350
        var destY = 40; //150
        var destWidth = sourceWidth;
        var destHeight = sourceHeight;

        ctx.clearRect(destX,destY,destWidth, destHeight);
        ctx.drawImage(imgobj, destX, destY, sourceWidth, sourceHeight);
}

function gps_signal_display(barval) {

        barTest++; /* test bar signal images */
        barTest = (barTest > 4) ? 0 : barTest;

        var barsig = barTest;
        //        var barsig = barval;

        if(barsig >= 0 && barsig <= 4) {
                display_sigbars(barsig, sigbar_image[barsig]) ;
        } else {
                addDebug('sigbar display out of range: ' + barsig);
        }
}

function display_icon(index, imgobj, window) {
        var APRS_IMG_MULT = 4;

        var can = document.getElementById(window);
        var ctx = can.getContext('2d');

        /* erase previous icon */
        ctx.clearRect(lastDestX,lastDestY,80,80);

        var icon_X = ((20 + 1) * APRS_IMG_MULT * (index % 16));
        /* divide by 16 using integer math */
        var icon_Y = ((20 + 1) * APRS_IMG_MULT * (index  >> 4));

        //                ctx.drawImage(img, 0, 0);
        var sourceX = icon_X + APRS_IMG_MULT;
        var sourceY = icon_Y + APRS_IMG_MULT;
        var sourceWidth = 20 * APRS_IMG_MULT;
        var sourceHeight = 20 * APRS_IMG_MULT;

        var destWidth = sourceWidth;
        var destHeight = sourceHeight;
        var destX = can.width / 2 - destWidth / 2;
        var destY = can.height / 2 - destHeight / 2;
        lastDestX = destX;
        lastDestY = destY;
        ctx.drawImage(imgobj, sourceX, sourceY, sourceWidth, sourceHeight, destX, destY, destWidth, destHeight);

        //        addDebug('icon: ' +  ' ' + sourceX + ' ' + sourceY + ' ' + sourceWidth + ' ' + sourceHeight + ' ' + destX + ' ' + destY +' Xind: ' + (index % 16) + ' Yind: ' + (index >> 2));
}

function remove_icon(window) {
        var APRS_IMG_MULT = 4;

        var can = document.getElementById(window);
        var ctx = can.getContext('2d');

        ctx.clearRect(lastDestX,lastDestY,80,80);
}

/*
 * jvalue should be /! or \!
 *   where ! can be any character from 0 to 96
 *   after subtracting char '!' value.
 */
function parse_icon(jvalue, window)
{
        if(jvalue.length != 2) {
                addDebug('icon: ' + 'None');
                remove_icon(window);
        } else {
                /* Get index of icon to use */
                var iconindexstr = jvalue.slice(1,2);
                var iconindex = iconindexstr.charCodeAt(0) - 0x21;

                /* Source of icons to use primay or secondary */
                var iconsrcstr = jvalue.slice(0,1);
                if( (iconsrcstr === '/') ||
                    (iconsrcstr === '\\') ||
                    (iconsrcstr >= '0' && iconsrcstr <= '9') ||
                    (iconsrcstr >= 'A' && iconsrcstr <= 'Z')
                  ) {
                        var image_object = (iconsrcstr === '/') ? imgpri : imgsec;

                        if(iconindex >= 0 && iconindex <= 96) {
                                if( (iconsrcstr !== '/') && (iconsrcstr !== '\\') ) {
                                        /* Not handling overlayed icons yet */
//                                        addDebug('icon: ' + jvalue + ' index: ' + iconindexstr + ' index num: '+ iconindex + ' slen: ' + jvalue.length + ' ' + ' src: ' +  iconsrcstr);
                                }
                                display_icon(iconindex, image_object, window);

                        } else {
                                addDebug('ICON INDEX OUT OF RANGE: ' + jvalue + ' index: ' + iconindexstr + ' index num: '+ iconindex + ' slen: ' + jvalue.length);
                        }
                } else {
                        addDebug('Invalid ICON table identifier: ' + iconsrcstr + ' value str: ' + jvalue);
                }
        }
}
$(function () {
        //        "use strict";

        /* Address of machine hosting aprs & node.js */
        var WebIpSock="1337";
        /* Get server IP */
        var WebIpAddr = window.location.hostname;
        var image_dir = './images/';

        // for better performance - to avoid searching in DOM
        var content = $('#content'); // Message history DIV
        var input = $('#input');
        var status = $('#status');
        var aprsCurrentWin = $('#aprswin1');
        var aprsHistWin = $('#histwin2_1');
        var aprsHistWin2 = $('#histwin2_2');
        var aprsGpsWin = $('#gpswin1');
        var gpswin2 = $('#gpswin2');
        var aprsWeatherWin = $('#aprsweather');
        var canwin1 = $('#canwin1');
        var canwin2 = $('#canwin2');
        var aprscurrent = $('#aprscurrent');
        var statsTotal = $('#stats_total');
        var statsMsg = $('#stats_msgcount');
        var statsWx = $('#stats_wxcount');
        var statsEncap = $('#stats_encapcount');
        var statsErrors = $('#stats_errorcount');
        var callsign_from = $('#callsign_from');
        var callsign_to = $('#callsign_to');
        var aprsEncapWin = $('#aprsdebugwin2');

        var aprsCallsignHistory = ["<p>first</p>","next"];

        // my color assigned by the server
        var myColor = false;
        // Set default color to display messages.
        var color = "black";
        // my name sent to the server
        var myName = false;
        // destination name sent to the server
        var destName = false;
        /* Interval clock Id for blinking current aprs window when new
         *  packet arrives. */
        var clockID = 0;
        // maximum number of APRS message to display in content DIV
        var maxMsgItems = 30;

        /* Load 5 signal bar image sources */

        var imgsigbar_0 = new Image();
        imgsigbar_0.src = image_dir + "bars_0.png";
        sigbar_image[0] = imgsigbar_0;

        var imgsigbar_1 = new Image();
        imgsigbar_1.src = image_dir + "bars_1.png";
        sigbar_image[1] = imgsigbar_1;

        var imgsigbar_2 = new Image();
        imgsigbar_2.src = image_dir + "bars_2.png";
        sigbar_image[2] = imgsigbar_2;

        var imgsigbar_3 = new Image();
        imgsigbar_3.src = image_dir + "bars_3.png";
        sigbar_image[3] = imgsigbar_3;

        var imgsigbar_4 = new Image();
        imgsigbar_4.src = image_dir + "bars_4.png";
        sigbar_image[4] = imgsigbar_4;

        sigbar_image[0].onload = function() {
                display_sigbars(0, sigbar_image[0]) ;
        }
        imgsigbar_0.onload = function() {
                display_sigbars(0, imgsigbar_0) ;
        }

        /* Load primary icon image source */
        imgpri = new Image();
        imgpri.src = image_dir + "aprs_pri_big.png";

        /* Load secondary icon image source */
        imgsec = new Image();
        imgsec.src = image_dir + "aprs_sec_big.png";

        /* get index of icon to view */
        var indexpri = ((4 * 16) + 15);

        imgpri.onload = function() {
                display_icon(indexpri, imgpri, 'canwin1');
        }

        /* get index of icon to view */
        var indexsec = ((2 * 16) + 14);

        imgsec.onload = function() {
                display_icon(indexsec, imgsec, 'canwin2');
        }

        // if user is running mozilla then use it's built-in WebSocket
        window.WebSocket = window.WebSocket || window.MozWebSocket;

        // if browser doesn't support WebSocket, just show some notification and exit
        if (!window.WebSocket) {
                content.html($('<p>', { text: 'Sorry, but your browser doesn\'t '
                + 'support WebSockets.'} ));
                input.hide();
                $('span').hide();
                return;
        }

        // open connection
        var connection = new WebSocket('ws://'+ WebIpAddr+':'+ WebIpSock);

        connection.onopen = function () {
                // first we want users to enter their names
                callsign_to.removeAttr('disabled');
                status.text('Enter message:');

                /*
                 * Request Source callsign
                 */
                connection.send(JSON.stringify( { type: 'getconfig', data: 'source_callsign'} ));
        };

        connection.onerror = function (error) {
                // just in there were some problems with conenction...
                content.html($('<p>', { text: 'Sorry, but there\'s some problem with your '
                + 'connection or the server is down.</p>' } ));
        };

        aprsCurrentWin.text('Current Win: ' );
        aprsHistWin.text('win2_1: Callsign history ');
        aprsHistWin2.text('win2_2: Callsign history ');
        aprsGpsWin.text('win3: ' );
        aprsWeatherWin.text('win4: ');
        aprsDebugWin.text('Debug window');
        content.text('Messages');
        aprsEncapWin.text('Encapsulated Packets');

        /* display server address */
        addDebug('URL: ' + window.location.hostname+ ' Port num: ' + window.location.port);

        var ai_win={'icon': "",
        'callsign': 'NOCALL',
        'course': 'STOPPED',
        'comment': 'What?',
        'distance': 'A long way from here' };

        var g_win={'spd': "status",
        'mycall': "No Call",
        'lastbeacon': "Beacon?",
        'sigbars': "0",
        'latlon': "0 0",
        'reason': "Reason"};

        var wx_win={'icon': "",
        'name': "No Name",
        'distance': "Last heard",
        'data': "raining cats and dogs",
        'comment': "Rarely used" };

        // most important part - incoming messages
        connection.onmessage = function (message) {
                // try to parse JSON message. Because we know that the server always returns
                // JSON this should work without any problem but we should make sure that
                // the massage is not chunked or otherwise damaged.
                try {
                        var json = JSON.parse(message.data);
                } catch (e) {
                        aprsDebugWin.append('This doesn\'t look like a valid JSON: ' + message.data);
                        console.log('This doesn\'t look like a valid JSON: ', message.data);
                        return;
                }

                // NOTE: if you're not sure about the JSON structure
                // check the server source code above
                if (json.type === 'color') { // first response from the server with user's color
                        myColor = json.data;
//                        status.text(myName + ': send to:').css('color', myColor);
//                        input.removeAttr('disabled').focus();
                        // from now user can start sending messages
                } else if (json.type === 'sendto') { // destination address
//                        status.text('send to: ' + destName + ': ').css('color', myColor);
//                        input.removeAttr('disabled').focus();

                } else if (json.type === 'history') { // entire message history

                        //                        content.html('<p>Where does this appear? ' + json.data.length + ' </p>');

                        // insert every single message to the chat window
                        var historydepth = (json.data.length > 3) ? 3 : json.data.length;

                        for (var i=0; i < historydepth; i++) {
                                addMessage(json.data[i].from, json.data[i].text,
                                           json.data[i].color, new Date(json.data[i].time));
                        }
                } else if (json.type === 'message') { // it's a single message
                        /* User should address 'To callsign:' */
                        callsign_to.removeAttr('disabled').focus(); // let the user address another message

                        content.remove("p:gt(2)");
                        addMessage(json.data.from, json.data.text,
                                   json.data.color, new Date(json.data.time));


                } else if (json.type === 'aprs') {
                        var json1 = JSON.parse(json.data);
                        var jname = json1.name.slice(0,-1);
                        var jvalue = json1.value.slice(0,-1);

                        //                        aprsDebugWin.append('<p>DEBUG2: ' + 'name: ' + jname + ' value: ' + jvalue + '</p>');

                        if(jname.indexOf("AI_") == 0) {

                                switch(json1.name.slice(0,-1)) {
                                        case 'AI_ICON':
                                                ai_win['icon'] = jvalue;
                                                parse_icon(jvalue, 'canwin1');
                                                break;
                                        case 'AI_CALLSIGN':
                                                ai_win['callsign'] = jvalue;
                                                break;
                                        case 'AI_COURSE':
                                                ai_win['course'] = jvalue;
                                                break;
                                        case 'AI_COMMENT':
                                                ai_win['comment'] = jvalue;
                                                break;
                                        case 'AI_DISTANCE':
                                                ai_win['distance'] = jvalue;
                                                break;
                                        default:
                                                aprsDebugWin.append('<p>' + 'AI_ catch all: ' + 'name: ' + json1.name + ' value: ' + json1.value + '</p>');
                                                break;
                                }

                                /**
                                 * Add data to the APRS current window
                                 *  - all AI_ Aprs Info elements
                                 * 3 lines total
                                 *  - line 1: call sign plus distance via, plus icon
                                 *  - line 2: speed, direction, altitude telemetry
                                 *  - line 3: Weather or other message info
                                 */
                                aprsCurrentWin.html('<p>' + ai_win.callsign + '&nbsp&nbsp' + ai_win.distance + '</p>'
                                        + '<p>' + ai_win.course + '&nbsp&nbsp' + '</p>'
                                        + '<p>' + ai_win.comment + '&nbsp&nbsp' + '</p>' );

                        } else if(jname.indexOf("G_") == 0) {

                                switch(json1.name.slice(0,-1)) {
                                        case 'G_SPD':
                                                g_win.spd = json1.value;
                                                break;

                                        case "G_MYCALL":
                                                g_win.mycall = json1.value;
                                                break;

                                        case "G_LASTBEACON":
                                                g_win.lastbeacon = json1.value;
                                                break;

                                        case 'G_SIGBARS':
                                                g_win.sigbars = json1.value;
                                                var barval = parseInt(json1.value, 10);
                                                //                                gps_signal_display(barval);
                                                break;

                                        case 'G_LATLON':
                                                g_win.latlon = json1.value;
                                                break;
                                        case 'G_REASON':
                                                g_win.reason = json1.value;
                                                break;
                                        default:
                                                aprsDebugWin.append('<p>' + 'G_ catch all: ' + 'name: ' + json1.name + ' value: ' + json1.value + '</p>');
                                                break;
                                }

                                /**
                                 * Add message to APRS current vehicle status window
                                 *  - all G_ GPS Info elements
                                 *  line 1: GPS status: lat/long, time, locked, number of sats
                                 *  line 2: Current position & altitude
                                 *  line 3: call sign, never, atrest, signal strength
                                 */
                                aprsGpsWin.html('<p>' + g_win.spd + '</p>'
                                                + '<p>' + g_win.latlon + '</p>'
                                                + '<p>' + g_win.mycall + " : " + g_win.reason + '</p>'
                                               );
                        } else if(jname.indexOf("AL_") == 0) {
                                switch(jname) {
                                        case 'AL_00':
                                                //						aprsDebugWin.append('<p>' + 'AL_ check ' + 'name: ' + jname + ' value: ' + jvalue + '</p>');

                                                aprsCallsignHistory[0] = '<p>' +  jvalue + '</p>';
                                                aprsHistWin.html('<p> </p>');
                                                aprsHistWin2.html('<p> </p>');

                                                for (var i=0; i < aprsCallsignHistory.length/2; i++) {
                                                        aprsHistWin.append(aprsCallsignHistory[i]);
                                                }
                                                for (i=aprsCallsignHistory.length/2;
                                                     i < aprsCallsignHistory.length; i++) {
                                                        aprsHistWin2.append(aprsCallsignHistory[i]);
                                                }
                                                break;
                                        case 'AL_01':
                                                aprsCallsignHistory[1] = '<p>' +  jvalue + '</p>';
                                                break;
                                        case 'AL_02':
                                                aprsCallsignHistory[2] = '<p>' +  jvalue + '</p>';
                                                break;
                                        case 'AL_03':
                                                aprsCallsignHistory[3] = '<p>' +  jvalue + '</p>';
                                                break;
                                        case 'AL_04':
                                                aprsCallsignHistory[4] = '<p>' +  jvalue + '</p>';
                                                break;
                                        case 'AL_05':
                                                aprsCallsignHistory[5] = '<p>' +  jvalue + '</p>';
                                                break;
                                        case 'AL_06':
                                                aprsCallsignHistory[6] = '<p>' +  jvalue + '</p>';
                                                break;
                                        case 'AL_07':
                                                aprsCallsignHistory[7] = '<p>' +  jvalue + '</p>';
                                                break;
                                        default:
                                                aprsDebugWin.append('<p>' + 'AL_ catch all: ' + 'name: ' + json1.name + ' value: ' + json1.value + '</p>');
                                                break;

                                }
                        } else if(jname.indexOf("WX_") == 0) {
                                switch(jname) {
                                        case 'WX_NAME':
                                                wx_win['name'] = jvalue;
                                                break;
                                        case 'WX_DIST':
                                                wx_win['distance'] = jvalue;
                                                break;
                                        case 'WX_DATA':
                                                wx_win['data'] = jvalue;
                                                break;
                                        case 'WX_COMMENT':
                                                wx_win['comment'] = jvalue;
                                                break;
                                        case 'WX_ICON':
                                                wx_win['icon'] = jvalue;
                                                parse_icon(jvalue, 'canwin2');
                                                break;
                                        default:
                                                aprsDebugWin.append('<p>' + 'WX_ catch all: ' + 'name: ' + json1.name + ' value: ' + json1.value + '</p>');
                                                break;
                                }

                                /**
                                 * Add data to the APRS weather window
                                 *  - all WX_ Aprs weather elements
                                 * 3 lines total
                                 *  - line 1: Name plus distance
                                 *  - line 2: Weather data
                                 *  - line 3: Comment
                                 *  icon goes on extreme right hand side
                                 */

                                aprsWeatherWin.html('<p>' + wx_win.name + '&nbsp&nbsp&nbsp' + wx_win.distance + '</p>'
                                        + '<p>' + wx_win.data + '&nbsp&nbsp' + '</p>'
                                        + '<p>' + wx_win.comment + '&nbsp&nbsp' + '</p>' );

                        } else if(jname.indexOf("I_") == 0) {
                                var flashColor="lightgreen";

                                if(clockID) {
                                        clearInterval(clockID);
                                }
                                switch(jname) {
                                        case 'I_RX':
                                                flashColor="DarkGreen";
                                                gps_signal_display(0);  /* test bar signal images */

                                                break;
                                        case 'I_TX':
                                                flashColor="red";
                                                break;

                                        case 'I_DG':
                                                flashColor="orange";
                                                break;

                                        deflault:
                                                aprsDebugWin.html('<p>' + 'I_ catch: ' + 'name: ' + json1.name + ' value: ' + json1.value + '</p>');
                                                break;
                                }
                                document.getElementById("aprswin1").style.backgroundColor=flashColor;
                                document.getElementById("canwin1").style.backgroundColor=flashColor;
                                document.getElementById("aprscurrent").style.backgroundColor=flashColor;


                                /* Set a timer to fire in 1 second */
                                clockID=setInterval(function() {

                                        /* Paint background of window 1 with its default color.
                                         * I_ messages will momentarily change this color.
                                         */
                                        document.getElementById("aprswin1").style.backgroundColor="lightgreen";
                                        document.getElementById("canwin1").style.backgroundColor="lightgreen";
                                        document.getElementById("aprscurrent").style.backgroundColor="lightgreen";


                                }, 1000);

                        } else if(jname.indexOf("ST_") == 0) {
                                /* Update statistics counters */
                                var jstat = JSON.parse(jvalue);

                                statsTotal.text(jstat.inPktCount);
                                statsMsg.text(jstat.inMsgCount);
                                statsWx.text(jstat.inWxCount);
                                statsEncap.text(jstat.encapCount);
                                statsErrors.text(jstat.fapErrorCount);

                        } else if(jname.indexOf("MS_") == 0) {
                                var n = $("#content").children().length;

                                content.append('<div class="item"><span style="color:' + color + '">' + '</span> '
                                               + json1.value + '</div>');

                                content.scrollTop(content[0].scrollHeight);

                                if (n > maxMsgItems) {
                                        $("#content").children("div:first").remove()
                                }
                        } else if(jname.indexOf("DB_") == 0) {
                                var n = $("#aprsdebugwin2").children().length;

                                aprsEncapWin.append('<div class="item"><span style="color:' + color + '">' + '</span> '
                                        + json1.value + '</div>');

                                aprsEncapWin.scrollTop(aprsEncapWin[0].scrollHeight);

                                if (n > maxMsgItems) {
                                        $("#aprsdebugwin2").children("div:first").remove()
                                }
                        } else if(jname.indexOf("CF_") == 0) {
                                callsign_from.attr('disabled', 'disabled').val(json1.value);
                                myName = json1.value;
                                addDebug('Callsign: ' + json1.name + ' value: ' + json1.value + ' myName: ' + myName);
                                // Let the websock server know
                                connection.send(JSON.stringify( { type: 'callsign', data: myName} ));

                        } else {
                                addDebug('Unhandled: ' + 'name: ' + json1.name + ' value: ' + json1.value);
                        }

                } else {
                        aprsDebugWin.append('<p>' + 'Parse: I\'ve never seen JSON like this: ' + JSON.stringify(json) + '</p>');

                        console.log('Hmm..., I\'ve never seen JSON like this: ', JSON.stringify(json));
                }

        };

        /**
         * Set 'To:' callsign when user presses Enter key
         **/
        callsign_to.keydown(function(e) {
                if (e.keyCode === 13) {
                        var msg = $(this).val();
                        if (!msg) {
                                return;
                        }
                        destName = msg;
                        connection.send(JSON.stringify( { type: 'sendto', data: msg} ));
                        status.text('Enter Message');
                        input.removeAttr('disabled').focus();
                        addDebug('Callsign set: ' + destName);
                }
        });

        /**
         * Send mesage when user presses Enter key
         **/
        input.keydown(function(e) {
                if (e.keyCode === 13) {
                        var msg = $(this).val();
                        if (!msg) {
                                return;
                        }
                        $(this).val('');
                        // disable the input field to make the user wait until server
                        // sends back response
                        input.attr('disabled', 'disabled');

                        if (destName === false) {
                                status.text('Error');
                                input.attr('disabled', 'disabled').val('Enter "To callsign:"' );

                        } else {
                                destName = false;
                                connection.send(JSON.stringify( { type: 'message', data: msg} ));
                        }
                }
                /*
                 * Reset input on receipt of escape
                 */
                if (e.keyCode === 27) {
                        callsign_to.removeAttr('disabled').focus();
                        status.text('Enter message:');
                        input.attr('disabled', 'disabled');
                }
        });

        /*
         * query checkbox for whether APRS message should be acked or
         * not
         */
        $('#msgack_checkbox').click(function() {
                if($('input:checkbox[name=msg_ack_check]').is(':checked')) {
                        addDebug('Checkbox checked');
                        connection.send(JSON.stringify( { type: 'setconfig', data: 'ack on'} ));
                } else {
                        addDebug('Checkbox NOT checked');
                        connection.send(JSON.stringify( { type: 'setconfig', data: 'ack off'} ));
                }
        });

        /**
         * This method is optional. If the server wasn't able to respond to the
         * in 3 seconds then show some error message to notify the user that
         * something is wrong.
         */
        setInterval(function() {
                if (connection.readyState !== 1) {
                        status.text('Error');
                        input.attr('disabled', 'disabled').val('Unable to communicate '
                                + 'with the WebSocket server.');
                }
        }, 3000);

        /**
         * Add message to the chat window
         */
        function addMessage(from, message, color, dt) {
                var n = $("#content").children().length;

                content.append('<div class="item"><span style="color:' + color + '">' + from + '</span> @ ' +
                               + (dt.getHours() < 10 ? '0' + dt.getHours() : dt.getHours()) + ':'
                               + (dt.getMinutes() < 10 ? '0' + dt.getMinutes() : dt.getMinutes())
                               + ': ' + message + '</div>');

                if (n > maxMsgItems) {
                        $("#content").children("div:first").remove()
                }
        }

        /**
         * Add message to the APRS History window
         *  - all AL_ Aprs List elements
         *  8 lines of call sign plus distance, direction
         */
        function addAprsHistory(from, message, color, dt) {
                content.append('<p><span style="color:' + color + '">' + from + '</span> @ ' +
                               + (dt.getHours() < 10 ? '0' + dt.getHours() : dt.getHours()) + ':'
                               + (dt.getMinutes() < 10 ? '0' + dt.getMinutes() : dt.getMinutes())
                               + ': ' + message + '</p>');
        }

        /**
         * Add message to the APRS Weather window
         *  - all WX_ Weather elements
         * line 1: call sign plus time last updated
         * line 2: Weather info: Temperature, rain, probability of rain
         * line 3:
         */
        function addAprsWeather(from, message, color, dt) {
                content.append('<p><span style="color:' + color + '">' + from + '</span> @ ' +
                               + (dt.getHours() < 10 ? '0' + dt.getHours() : dt.getHours()) + ':'
                               + (dt.getMinutes() < 10 ? '0' + dt.getMinutes() : dt.getMinutes())
                               + ': ' + message + '</p>');
        }
});