/* -*- Mode: C; tab-width: 8;  indent-tabs-mode: nil; c-basic-offset: 8; c-brace-offset: -8; c-argdecl-indent: 8 -*- */
/* Copyright 2012 Dan Smith <dsmith@danplanet.com> */

#include <unistd.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <errno.h>
#include <sys/socket.h>
#include <sys/un.h>
#include <stdbool.h>
#include <json/json.h>

#include "aprs.h"
#include "ui.h"
#include "util.h"


/* Used to ACK APRS messages */
int mesg_id = 0;
int glaprs_message_ack = false;

int ui_connect(struct sockaddr *dest, unsigned int dest_len)
{
	int sock;

	sock = socket(dest->sa_family, SOCK_STREAM, 0);
	if (sock < 0) {
		perror("socket");
		return -errno;
	}

	if (connect(sock, dest, dest_len)) {
		fprintf(stderr, "%s: connect error on socket %d: %s\n",
			  __FUNCTION__, sock, strerror(errno));
		close(sock);
		return -errno;
	}

	return sock;
}

struct ui_msg *build_lcd_msg(uint16_t msg_type, const char *name, const char *value)
{
	struct ui_msg *msg;
	int len;
	int offset;

	len = sizeof(*msg) + strlen(name) + strlen(value) + 2;
	msg = malloc(len);
	if(msg == NULL) {
		printf("%s: malloc error: %s\n",
		       __FUNCTION__, strerror(errno));
		return msg;
	}

	msg->type = msg_type;
	msg->length = len;
	msg->name_value.name_len = strlen(name) + 1;
	msg->name_value.valu_len = strlen(value) + 1;

	offset = sizeof(*msg);
	memcpy((char*)msg + offset, name, msg->name_value.name_len);

	offset += msg->name_value.name_len;
	memcpy((char*)msg + offset, value, msg->name_value.valu_len);

#ifdef DEBUG_VERBOSE_1
	printf("%s: type: %d, len: %d, name_len: %d, value_len: %d, str_name: %s, str_value: %s\n",
	       __FUNCTION__,
	       msg->type,
	       msg->length,
	       msg->name_value.name_len,
	       msg->name_value.valu_len,
	       name,
	       value
	       //	       (char*)msg + sizeof(struct ui_msg)
	      );
#endif /* DEBUG */

	return msg;
}

int ui_send(int sock, const char *name, const char *value)
{
	struct ui_msg *msg;
	int ret;

	msg = build_lcd_msg(MSG_SETVALUE, name, value);
	if(msg == NULL) {
		return -ENOMEM;
	}

	ret = send(sock, msg, msg->length, MSG_NOSIGNAL);

	free(msg);
	return ret;
}

int ui_send_to(struct sockaddr *dest, unsigned int dest_len,
	       const char *name, const char *value)
{
	int sock;
	int ret;

	if (strlen(name) == 0)
		return -EINVAL;

	sock = ui_connect(dest, dest_len);
	if (sock < 0)
		return sock;

	ret = ui_send(sock, name, value);

	close(sock);

	return ret;
}

#define RBUFSIZE 1024

int ui_get_json_msg(int sock, struct ui_msg **msg, struct ui_msg *hdr)
{
	char *buf = (char *)hdr;
	char json_str[RBUFSIZE];
	char aprs_msg[128]; /* largest legal APRS Message is 84 bytes */
	int json_len;
	int ret;

	memset(json_str, 0, RBUFSIZE);

	strncat(json_str, buf, sizeof(struct ui_msg));
	json_len = strlen(json_str);

	ret = read(sock, &json_str[json_len], RBUFSIZE-json_len);

	if(ret > 0) {
		json_object *new_obj, *data_obj, *to_obj, *msg_obj, *type_obj;
		char *to_str,  *msg_str, *type_str;

		if(ret == RBUFSIZE-json_len) {
			printf("%s: Warning sock read size suspiciously large\n",
			       __FUNCTION__);
		}

		new_obj = json_tokener_parse(json_str);
		printf("json str: %s\n", json_str);
		printf("new_obj.to_string()=%s\n", json_object_to_json_string(new_obj));
		type_obj = json_object_object_get(new_obj, "type");
		data_obj = json_object_object_get(new_obj, "data");

                type_str = (char *)json_object_get_string(type_obj);
#ifdef DEBUG_VERBOSE
                printf("Got message type: %s\n", type_str);
#endif /*  DEBUG_VERBOSE */

		if(STREQ(type_str, "message")) {
#if 0 /* reference, currently not used */
			json_object *from_obj;
			from_obj = json_object_object_get(data_obj, "from");
#endif /* reference */

			to_obj = json_object_object_get(data_obj, "sendto");
                        msg_obj = json_object_object_get(data_obj, "text");
#ifdef DEBUG_VERBOSE
			printf("json to: %s, msg: %s\n",
			       json_object_get_string(to_obj),
			       json_object_get_string(msg_obj));
#endif /*  DEBUG_VERBOSE */
			to_str = (char *)json_object_get_string(to_obj);
			/* qualify APRS addressee string */
			strupper(to_str); /* APRS requies upper case call signs */
			if(strlen(to_str) > MAX_CALLSIGN ) {
				*(to_str + MAX_CALLSIGN)='\0';
			}
			msg_str = (char *)json_object_get_string(msg_obj);

			/* qualify APRS message text string */
			if(strlen(msg_str) > MAX_APRS_MSG_LEN) {
				*(msg_str + MAX_APRS_MSG_LEN)='\0';
			}

			mesg_id++; /* Bump APRS message number */
			/* create a ui_msg from json,
			 * reference page 71 APRS protocol 1.0.1 */
			if(glaprs_message_ack) {
				sprintf(aprs_msg,":%-9s:%s{%02d",
					  to_str,
					  msg_str,
					  mesg_id);
			} else {
				sprintf(aprs_msg,":%-9s:%s",
					  to_str,
					  msg_str);
			}
			printf("aprs msg: %s\n", aprs_msg);

			*msg = build_lcd_msg(MSG_SEND, UI_MSG_NAME_SEND, aprs_msg);

		} else if(STREQ(type_str, "setconfig")) {

			char *data_str;

			data_str = (char *)json_object_get_string(data_obj);
			/* Set a global boolean,
			 *  -should be in conf struct */
			glaprs_message_ack = STREQ(data_str, "ack on");
			printf("DEBUG: ACK is turned %s\n", glaprs_message_ack ? "ON" : "OFF");

			*msg = build_lcd_msg(MSG_SEND, UI_MSG_NAME_SETCFG, aprs_msg);

                } else if(STREQ(type_str, "getconfig")) {

                        char *data_str;

                        data_str = (char *)json_object_get_string(data_obj);

                        printf("DEBUG: getconfig request for %s, verified: %s\n",
                               data_str, STREQ(data_str, "source_callsign") ? "yes" : "no");
                        strcpy(aprs_msg, data_str);
                        *msg = build_lcd_msg(MSG_SEND, UI_MSG_NAME_GETCFG, aprs_msg);

                } else {
			printf("Unhandled message type: %s\n", type_str);
		}

	} else {
		printf("%s: socket read error: %s\n",
		       __FUNCTION__, strerror(errno));
	}

	return ret;
}

/*
 * Read socket sourced from displays of either web app or lcd hardware
 *
 * lcd hardware sends struct ui_msg
 * web apps sends json which gets converted to struct ui_msg
 *
 */
int ui_get_msg(int sock, struct ui_msg **msg)
{
	struct ui_msg hdr;
	char *buf = (char *)&hdr;
	int ret;

	ret = read(sock, &hdr, sizeof(hdr));
	if (ret <= 0)
		return ret;

	/*
	 * Retain compatibility with previous code
	 * Read the rest of the message as JSON
	 */
	{
		int i;
		for(i=0; i < 7; i++) {
			printf("%02x ", buf[i]);
		}
		printf("\n");
	}
	if(STRNEQ(buf, "{\"type\":", sizeof(hdr))) {
		ret = ui_get_json_msg( sock, msg, &hdr);
	} else {
		*msg = malloc(hdr.length);
		if (*msg == NULL) {
			printf("%s: malloc error: %s\n",
			       __FUNCTION__, strerror(errno));
			return -ENOMEM;
		}

		memcpy(*msg, &hdr, sizeof(hdr));

		ret = read(sock, ((char *)*msg)+sizeof(hdr), hdr.length - sizeof(hdr));
	}
	return 1;
}

char *ui_get_msg_name(struct ui_msg *msg)
{
	if (msg->type != MSG_SETVALUE &&
	   msg->type != MSG_SEND) {
		printf("msg type not 0x%02x but is 0x%02x\n",
		       MSG_SETVALUE, msg->type);
		return NULL;
	}

	return (char*)msg + sizeof(*msg);
}

void filter_to_ascii(char *string)
{
	int i;

	for (i = 0; string[i]; i++) {
		if ((string[i] < 0x20 || string[i] > 0x7E) &&
		    (string[i] != '\r' && string[i] != '\n'))
			string[i] = ' ';
	}
}

char *ui_get_msg_valu(struct ui_msg *msg)
{
	if (msg->type != MSG_SETVALUE &&
	   msg->type != MSG_SEND) {
		return NULL;
	}

	filter_to_ascii((char *)msg + sizeof(*msg) + msg->name_value.name_len);

	return (char*)msg + sizeof(*msg) + msg->name_value.name_len;
}

#ifdef MAIN
#include <getopt.h>
#include <sys/un.h>
#include <netdb.h>
#include <netinet/in.h>

#include "util.h"

struct opts {
	int addr_family;
	char name[64];
	char value[64];
};

int parse_ui_opts(int argc, char **argv, struct opts *opts)
{
	int retval = 1;

	static struct option lopts[] = {
		{"window",    0, 0, 'w'},
		{"inet",      0, 0, 'i'},
		{NULL,        0, 0,  0 },
	};

	memset(opts, 0, sizeof(opts));

	/* Set default options */
	opts->addr_family = AF_INET;
	strcpy(opts->name, "AI_CALLSIGN");
	strcpy(opts->value, "DEFAULT");

	while (1) {
		int c;
		int optidx;

		c = getopt_long(argc, argv, "wi", lopts, &optidx);
		if (c == -1)
			break;

		switch(c) {
			case 'w':
				opts->addr_family = AF_UNIX;
				break;
			case 'i':
				opts->addr_family = AF_INET;
		}
	}

	/*
	 * Set positional args
	 */
	/* get the NAME */
	if(optind < argc) {
		strcpy(opts->name, argv[optind]);
		strupper(opts->name);
		optind++;
	}

	/* get the VALUE */
	if(optind < argc) {
		strcpy(opts->value, argv[optind]);
		optind++;
	}

	if(argc == 1)
		retval = 0;
	else if(argc < 4)
		printf("Using defaults\n");

	return (retval);
}

int ui_send_default(struct opts *opts, struct state *state)
{

	if(opts->addr_family == AF_INET) {
		printf("using AF_INET\n");
		char hostname[]="127.0.0.1";
		struct sockaddr_in sin;
		struct hostent *host;

		sin.sin_family = AF_INET;
		sin.sin_port = htons(state->conf.ui_sock_port);

		host = gethostbyname(hostname);
		if (!host) {
			perror(hostname);
			return -errno;
		}

		if (host->h_length < 1) {
			fprintf(stderr, "No address for %s\n", hostname);
			return -EINVAL;
		}
		memcpy(&sin.sin_addr, host->h_addr_list[0], sizeof(sin.sin_addr));

		return ui_send_to((struct sockaddr *)&sin, sizeof(sin),
				  opts->name, opts->value);
	} else {
		printf("using AF_UNIX\n");
		struct sockaddr_un sun;
		sun.sun_family = AF_UNIX;
		strcpy(sun.sun_path, state->conf.ui_sock_path);
		return ui_send_to((struct sockaddr *)&sun, sizeof(sun),
				  opts->name, opts->value);
	}
}

int main(int argc, char **argv)
{
        int ret;
        struct opts opts;
        struct state state;

        memset(&state, 0, sizeof(state));

	if(!parse_ui_opts(argc, argv, &opts)) {
		printf("Usage: %s -<i><w> [NAME] [VALUE]\n", argv[0]);
		return 1;
        }

        if (parse_ini(state.conf.config ? state.conf.config : "aprs.ini", &state)) {
                printf("Invalid config\n");
                exit(1);
        }

	printf("%d, %s %s\n", opts.addr_family, opts.name, opts.value);

        ret = ui_send_default(&opts, &state);
        ini_cleanup(&state);

        return(ret);
}
#endif
